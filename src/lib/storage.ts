import crypto from "crypto";
import {
    BlobServiceClient,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
    StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { logger } from "./logger";

export interface PresignUploadResult {
    uploadUrl: string;
    s3Key: string;
    headers: Record<string, string>;
}

export interface StorageService {
    getPresignedUploadUrl(
        blobName: string,
        mimeType: string,
        contentLength: number,
    ): Promise<PresignUploadResult>;
    getPresignedDownloadUrl(
        blobName: string,
        fileName: string,
    ): Promise<string>;
}

class AzureBlobStorageService implements StorageService {
    private blobServiceClient: BlobServiceClient;
    private containerName: string;
    private sharedKeyCredential?: StorageSharedKeyCredential;

    constructor() {
        this.containerName = process.env.AZURE_CONTAINER_NAME ?? "documents";
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

        if (!connectionString) {
            throw new Error("AZURE_STORAGE_CONNECTION_STRING is missing");
        }

        this.blobServiceClient =
            BlobServiceClient.fromConnectionString(connectionString);

        // Extract account name and key to sign SAS tokens
        const accountName = /AccountName=([^;]+)/.exec(connectionString)?.[1];
        const accountKey = /AccountKey=([^;]+)/.exec(connectionString)?.[1];

        if (accountName && accountKey) {
            this.sharedKeyCredential = new StorageSharedKeyCredential(
                accountName,
                accountKey,
            );
        }
    }

    async getPresignedUploadUrl(
        blobName: string,
        mimeType: string,
        _contentLength: number,
    ): Promise<PresignUploadResult> {
        const containerClient = this.blobServiceClient.getContainerClient(
            this.containerName,
        );
        const blobClient = containerClient.getBlobClient(blobName);

        if (!this.sharedKeyCredential)
            throw new Error("Missing Azure Credentials for SAS");

        const sasToken = generateBlobSASQueryParameters(
            {
                containerName: this.containerName,
                blobName: blobName,
                permissions: BlobSASPermissions.parse("cw"), // create and write
                startsOn: new Date(),
                expiresOn: new Date(new Date().valueOf() + 15 * 60 * 1000), // 15 mins
            },
            this.sharedKeyCredential,
        ).toString();

        return {
            uploadUrl: `${blobClient.url}?${sasToken}`,
            s3Key: blobName, // Keeping the variable name 's3Key' so we don't have to rewrite the rest of your app
            headers: {
                "x-ms-blob-type": "BlockBlob",
                "Content-Type": mimeType,
            },
        };
    }

    async getPresignedDownloadUrl(
        blobName: string,
        fileName: string,
    ): Promise<string> {
        const containerClient = this.blobServiceClient.getContainerClient(
            this.containerName,
        );
        const blobClient = containerClient.getBlobClient(blobName);

        if (!this.sharedKeyCredential)
            throw new Error("Missing Azure Credentials for SAS");

        const sasToken = generateBlobSASQueryParameters(
            {
                containerName: this.containerName,
                blobName: blobName,
                permissions: BlobSASPermissions.parse("r"), // read only
                startsOn: new Date(),
                expiresOn: new Date(new Date().valueOf() + 5 * 60 * 1000), // 5 mins
                contentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
            },
            this.sharedKeyCredential,
        ).toString();

        return `${blobClient.url}?${sasToken}`;
    }
}

class LocalMockStorageService implements StorageService {
    async getPresignedUploadUrl(
        s3Key: string,
        mimeType: string,
        _contentLength: number,
    ): Promise<PresignUploadResult> {
        const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3001";
        return {
            uploadUrl: `${appUrl}/api/mock-upload?key=${encodeURIComponent(s3Key)}`,
            s3Key,
            headers: { "Content-Type": mimeType },
        };
    }

    async getPresignedDownloadUrl(
        s3Key: string,
        fileName: string,
    ): Promise<string> {
        const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3001";
        return `${appUrl}/api/mock-download?key=${encodeURIComponent(s3Key)}&name=${encodeURIComponent(fileName)}`;
    }
}

const isAzureConfigured =
    process.env.STORAGE_DRIVER !== "local" &&
    Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING);

export const storageService: StorageService = isAzureConfigured
    ? new AzureBlobStorageService()
    : new LocalMockStorageService();

logger.info(
    { driver: isAzureConfigured ? "Azure Blob" : "Local/Mock" },
    "Storage service initialized",
);

export function generateSafeS3Key(
    ownerId: string,
    clientId: string,
    fileName: string,
): string {
    const uuid = crypto.randomUUID();
    const sanitized = fileName
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "_")
        .slice(0, 80);
    return `owners/${ownerId}/clients/${clientId}/${uuid}-${sanitized}`;
}
