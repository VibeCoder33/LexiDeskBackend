import crypto from "crypto";
import prisma from "../../lib/prisma";
import { AppError } from "../../lib/AppError";
import { logger } from "../../lib/logger";
import { storageService, generateSafeS3Key } from "../../lib/storage";
import { writeAuditLog } from "../audit/audit.service";
import { recomputeClientStatus } from "../clients/clients.service";
import { verificationProvider } from "../verification/verification.provider";
import { ROLE_CONFIG, RoleKey } from "../../config/roles";
import { PortalPresignInput, PortalCompleteInput } from "./portal.schema";
import {
    ClientStatus,
    VerificationStatus,
} from "../../generated/prisma/client";

function hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function validateAndResolveToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    // Change findUnique to findFirst, and use an OR condition
    const link = await prisma.magicLink.findFirst({
        where: {
            OR: [{ tokenHash }, { id: rawToken }],
        },
        include: {
            client: {
                include: {
                    owner: true,
                    requirements: {
                        orderBy: { sortOrder: "asc" },
                        include: { documents: true },
                    },
                },
            },
        },
    });

    // Never reveal whether token was expired, revoked, or non-existent
    if (!link || link.revokedAt || link.expiresAt < new Date()) {
        throw new AppError("This link is no longer valid", 404);
    }

    return link;
}

export async function getPortalInfo(rawToken: string) {
    const link = await validateAndResolveToken(rawToken);
    const client = link.client;
    const owner = client.owner;

    // Update lastUsedAt asynchronously
    prisma.magicLink
        .update({
            where: { id: link.id },
            data: { lastUsedAt: new Date() },
        })
        .catch((err: Error) => {
            logger.error({ err }, "Failed to update magic link lastUsedAt");
        });

    const clientFirstName = client.name.split(" ")[0] ?? client.name;

    const requirements = client.requirements.map((req) => ({
        id: req.id,
        label: req.label,
        category: req.category,
        isRequired: req.isRequired,
        done: req.documents.length > 0,
    }));

    return {
        professionalName: owner.name,
        firmName: owner.firmName || `${owner.name}'s Office`,
        clientFirstName,
        clientName: client.name,
        matterType: client.matterType,
        requirements,
        expired: false,
    };
}

export async function presignPortalUpload(
    rawToken: string,
    input: PortalPresignInput,
) {
    const link = await validateAndResolveToken(rawToken);
    const client = link.client;

    const s3Key = generateSafeS3Key(client.ownerId, client.id, input.fileName);
    const presignResult = await storageService.getPresignedUploadUrl(
        s3Key,
        input.mimeType,
        input.sizeBytes,
    );

    return presignResult;
}

export async function completePortalUpload(
    rawToken: string,
    input: PortalCompleteInput,
) {
    const link = await validateAndResolveToken(rawToken);
    const client = link.client;
    const owner = client.owner;

    // Verify prefix matches tenant key
    const expectedPrefix = `owners/${client.ownerId}/clients/${client.id}/`;
    if (!input.s3Key.startsWith(expectedPrefix)) {
        throw new AppError("Invalid upload destination path", 400);
    }

    // Determine category
    let category = "Other";
    let expectedLabel: string | undefined;

    if (input.requirementId) {
        const req = client.requirements.find(
            (r) => r.id === input.requirementId,
        );
        if (req) {
            category = req.category;
            expectedLabel = req.label;
        }
    }

    const roleConfig =
        owner.role in ROLE_CONFIG
            ? ROLE_CONFIG[owner.role as RoleKey]
            : undefined;
    const roleCategories = roleConfig
        ? roleConfig.documentCategories
        : ["Other"];

    if (category === "Other" && roleCategories.length > 0) {
        category = roleCategories[0] ?? "Other";
    }

    // Create Document row in DB
    const document = await prisma.document.create({
        data: {
            clientId: client.id,
            requirementId: input.requirementId ?? null,
            ownerId: client.ownerId,
            s3Key: input.s3Key,
            fileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            category,
            verification: VerificationStatus.PENDING,
        },
    });

    // Bump lastActiveAt and set ACTION_NEEDED
    await prisma.client.update({
        where: { id: client.id },
        data: {
            status: ClientStatus.ACTION_NEEDED,
            lastActiveAt: new Date(),
        },
    });

    writeAuditLog({
        userId: "portal",
        action: "DOCUMENT_UPLOADED",
        entity: "Document",
        entityId: document.id,
        meta: { fileName: input.fileName, clientId: client.id },
    });

    // Trigger AI / Mock verification asynchronously
    setImmediate(async () => {
        try {
            const result = await verificationProvider.verify({
                s3Key: document.s3Key,
                mimeType: document.mimeType,
                expectedLabel,
                roleCategories,
            });

            await prisma.document.update({
                where: { id: document.id },
                data: {
                    verification: result.status,
                    detectedType: result.detectedType,
                    category: result.category,
                    verificationNote: result.reason ?? null,
                },
            });

            await recomputeClientStatus(client.id);
            logger.info(
                { documentId: document.id, result },
                "Verification completed",
            );
        } catch (err) {
            logger.error(
                { err, documentId: document.id },
                "Verification async failure",
            );
            await prisma.document.update({
                where: { id: document.id },
                data: {
                    verification: VerificationStatus.NEEDS_REVIEW,
                    verificationNote:
                        "Verification process encountered an unexpected issue.",
                },
            });
            await recomputeClientStatus(client.id);
        }
    });

    return {
        message: "Document uploaded successfully",
        document: {
            id: document.id,
            fileName: document.fileName,
            category: document.category,
            verification: document.verification,
        },
    };
}
