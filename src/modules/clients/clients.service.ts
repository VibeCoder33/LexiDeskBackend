import crypto from "crypto";
import prisma from "../../lib/prisma";
import { AppError } from "../../lib/AppError";
import { writeAuditLog } from "../audit/audit.service";
import { CHECKLIST_TEMPLATES } from "../../config/checklists";
import { ROLE_CONFIG, RoleKey } from "../../config/roles";
import {
    CreateClientInput,
    UpdateClientInput,
    UpdateRequirementsInput,
} from "./clients.schema";
import { ClientStatus, Prisma } from "../../generated/prisma/client";

const MAGIC_LINK_TTL_DAYS = parseInt(
    process.env.MAGIC_LINK_TTL_DAYS ?? "30",
    10,
);

export function generateMagicToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");
    return { rawToken, tokenHash };
}

export function buildMagicLinkUrl(rawToken: string): string {
    const baseUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3001";
    return `${baseUrl}/portal/${rawToken}`;
}

export async function recomputeClientStatus(
    clientId: string,
): Promise<ClientStatus> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
            links: { orderBy: { createdAt: "desc" }, take: 1 },
            requirements: {
                include: { documents: true },
            },
            documents: true,
        },
    });

    if (!client) return ClientStatus.CLOSED;

    const activeLink = client.links[0];
    const isRevoked = Boolean(activeLink?.revokedAt);

    if (isRevoked) {
        if (client.status !== ClientStatus.CLOSED) {
            await prisma.client.update({
                where: { id: clientId },
                data: { status: ClientStatus.CLOSED },
            });
        }
        return ClientStatus.CLOSED;
    }

    // Check for action needed: unreviewed uploads or NEEDS_REVIEW verification
    const hasUnreviewed = client.documents.some((d) => !d.reviewedAt);
    const hasNeedsReview = client.documents.some(
        (d) => d.verification === "NEEDS_REVIEW",
    );

    if (hasUnreviewed || hasNeedsReview) {
        if (client.status !== ClientStatus.ACTION_NEEDED) {
            await prisma.client.update({
                where: { id: clientId },
                data: { status: ClientStatus.ACTION_NEEDED },
            });
        }
        return ClientStatus.ACTION_NEEDED;
    }

    // Check if required items are missing
    const hasMissingRequired = client.requirements.some(
        (req) => req.isRequired && req.documents.length === 0,
    );

    if (hasMissingRequired) {
        if (client.status !== ClientStatus.WAITING_ON_CLIENT) {
            await prisma.client.update({
                where: { id: clientId },
                data: { status: ClientStatus.WAITING_ON_CLIENT },
            });
        }
        return ClientStatus.WAITING_ON_CLIENT;
    }

    // Everything present and reviewed
    if (client.status !== ClientStatus.UP_TO_DATE) {
        await prisma.client.update({
            where: { id: clientId },
            data: { status: ClientStatus.UP_TO_DATE },
        });
    }
    return ClientStatus.UP_TO_DATE;
}

export async function getClients(
    userId: string,
    params: {
        q?: string;
        status?: string;
        matterType?: string;
        sort?: string;
        order?: "asc" | "desc";
        page?: number;
        limit?: number;
    },
) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
        ownerId: userId,
    };

    if (params.q) {
        const q = params.q.trim();
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { matterType: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
        ];
    }

    if (params.status && params.status !== "ALL") {
        where.status = params.status as ClientStatus;
    }

    if (params.matterType && params.matterType !== "ALL") {
        where.matterType = params.matterType;
    }

    const orderBy: Prisma.ClientOrderByWithRelationInput = {};
    const sortKey = params.sort ?? "lastActiveAt";
    const sortOrder = params.order === "asc" ? "asc" : "desc";

    if (sortKey === "name") orderBy.name = sortOrder;
    else if (sortKey === "matterType") orderBy.matterType = sortOrder;
    else if (sortKey === "status") orderBy.status = sortOrder;
    else if (sortKey === "createdAt") orderBy.createdAt = sortOrder;
    else orderBy.lastActiveAt = sortOrder;

    const [total, clients] = await Promise.all([
        prisma.client.count({ where }),
        prisma.client.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: {
                _count: {
                    select: { documents: true, requirements: true },
                },
            },
        }),
    ]);

    return {
        clients,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function createClient(
    userId: string,
    userRole: RoleKey,
    input: CreateClientInput,
) {
    // Validate details against role config if applicable
    const roleCfg =
        userRole in ROLE_CONFIG ? ROLE_CONFIG[userRole as RoleKey] : undefined;
    if (roleCfg) {
        for (const field of roleCfg.createFields) {
            if (field.required && !input.details[field.name]) {
                throw new AppError(
                    `Missing required field: ${field.label || field.name}`,
                    400,
                );
            }
        }
    }

    // Get checklist template
    const template =
        CHECKLIST_TEMPLATES[input.matterType] ??
        (roleCfg
            ? roleCfg.documentCategories.map((c: string) => ({
                  label: `${c} Document`,
                  category: c,
                  isRequired: true,
              }))
            : [
                  {
                      label: "Identity Proof",
                      category: "ID Proofs",
                      isRequired: true,
                  },
              ]);

    const { rawToken, tokenHash } = generateMagicToken();
    const expiresAt = new Date(
        Date.now() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const client = await prisma.$transaction(async (tx) => {
        const created = await tx.client.create({
            data: {
                ownerId: userId,
                name: input.name,
                phone: input.phone,
                matterType: input.matterType,
                details: input.details as unknown as Prisma.InputJsonValue,
                keyDate: input.keyDate ? new Date(input.keyDate) : null,
                keyDateLabel: input.keyDateLabel ?? null,
                status: ClientStatus.WAITING_ON_CLIENT,
            },
        });

        // Create checklist requirements
        await tx.documentRequirement.createMany({
            data: template.map(
                (
                    item: {
                        label: string;
                        category: string;
                        isRequired: boolean;
                    },
                    idx: number,
                ) => ({
                    clientId: created.id,
                    label: item.label,
                    category: item.category,
                    isRequired: item.isRequired,
                    sortOrder: idx,
                }),
            ),
        });

        // Create first MagicLink
        await tx.magicLink.create({
            data: {
                clientId: created.id,
                tokenHash,
                expiresAt,
            },
        });

        return created;
    });

    writeAuditLog({
        userId,
        action: "CLIENT_CREATED",
        entity: "Client",
        entityId: client.id,
        meta: { name: client.name, matterType: client.matterType },
    });

    return {
        client,
        magicLink: {
            url: buildMagicLinkUrl(rawToken),
            expiresAt,
        },
    };
}

export async function getClientById(userId: string, clientId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
        include: {
            requirements: {
                orderBy: { sortOrder: "asc" },
                include: {
                    documents: {
                        orderBy: { uploadedAt: "desc" },
                    },
                },
            },
            documents: {
                orderBy: { uploadedAt: "desc" },
            },
            links: {
                orderBy: { createdAt: "desc" },
                take: 1,
            },
        },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    // Sanitize any previously misclassified documents (e.g. concept notes, AI files falsely placed in ID Proofs)
    for (const doc of client.documents) {
        const fn = doc.fileName.toLowerCase();
        const isIdentity =
            fn.includes("pan") ||
            fn.includes("aadhaar") ||
            fn.includes("aadhar") ||
            fn.includes("passport") ||
            fn.includes("voter") ||
            fn.includes("driving") ||
            fn.includes("identity");
        const isUnrecognized =
            fn.includes("concept") ||
            fn.includes("ai_") ||
            fn.includes("ai ") ||
            fn.includes("ai-") ||
            fn.includes("unknown") ||
            fn.includes("unrecognized");

        if (doc.category === "ID Proofs" && isUnrecognized && !isIdentity) {
            doc.category = "Uncategorized";
            doc.verification = "NEEDS_REVIEW" as any;
            doc.detectedType = "UNRECOGNIZED_DOCUMENT";
            doc.requirementId = null;
            prisma.document
                .update({
                    where: { id: doc.id },
                    data: {
                        category: "Uncategorized",
                        verification: "NEEDS_REVIEW",
                        detectedType: "UNRECOGNIZED_DOCUMENT",
                        requirementId: null,
                        verificationNote:
                            "Unrecognized document moved to Uncategorized for review",
                    },
                })
                .catch(() => {});
        }
    }

    const latestLink = client.links[0] ?? null;

    return {
        ...client,
        magicLink: latestLink
            ? {
                  id: latestLink.id,
                  expiresAt: latestLink.expiresAt,
                  revokedAt: latestLink.revokedAt,
                  lastUsedAt: latestLink.lastUsedAt,
                  nudgedAt: latestLink.nudgedAt,
                  isRevoked: Boolean(latestLink.revokedAt),
                  isExpired: latestLink.expiresAt < new Date(),
              }
            : null,
    };
}

export async function updateClient(
    userId: string,
    clientId: string,
    input: UpdateClientInput,
) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    const data: Prisma.ClientUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.matterType !== undefined) data.matterType = input.matterType;
    if (input.details !== undefined)
        data.details = input.details as unknown as Prisma.InputJsonValue;
    if (input.keyDate !== undefined)
        data.keyDate = input.keyDate ? new Date(input.keyDate) : null;
    if (input.keyDateLabel !== undefined)
        data.keyDateLabel = input.keyDateLabel;
    if (input.isBilled !== undefined) data.isBilled = input.isBilled;

    const updated = await prisma.client.update({
        where: { id: clientId },
        data,
    });

    writeAuditLog({
        userId,
        action: "CLIENT_UPDATED",
        entity: "Client",
        entityId: clientId,
        meta: input as unknown as Prisma.InputJsonValue,
    });

    return updated;
}

export const updateClientStatus = async (
    id: string,
    status: "ACTION_NEEDED" | "WAITING_ON_CLIENT" | "UP_TO_DATE" | "CLOSED",
) => {
    return await prisma.client.update({
        where: { id },
        data: { status },
    });
};

export async function updateScratchpad(
    userId: string,
    clientId: string,
    scratchpad: string,
) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    return prisma.client.update({
        where: { id: clientId },
        data: { scratchpad },
    });
}

export async function updateRequirements(
    userId: string,
    clientId: string,
    input: UpdateRequirementsInput,
) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    await prisma.$transaction(async (tx) => {
        // Delete existing requirements not in input list
        const incomingIds = input.requirements
            .map((r) => r.id)
            .filter(Boolean) as string[];
        await tx.documentRequirement.deleteMany({
            where: {
                clientId,
                id: { notIn: incomingIds },
            },
        });

        // Upsert items
        for (const item of input.requirements) {
            if (item.id) {
                await tx.documentRequirement.update({
                    where: { id: item.id },
                    data: {
                        label: item.label,
                        category: item.category,
                        isRequired: item.isRequired,
                        sortOrder: item.sortOrder,
                    },
                });
            } else {
                await tx.documentRequirement.create({
                    data: {
                        clientId,
                        label: item.label,
                        category: item.category,
                        isRequired: item.isRequired,
                        sortOrder: item.sortOrder,
                    },
                });
            }
        }
    });

    await recomputeClientStatus(clientId);

    return getClientById(userId, clientId);
}

export async function regenerateLink(userId: string, clientId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    const { rawToken, tokenHash } = generateMagicToken();
    const expiresAt = new Date(
        Date.now() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await prisma.$transaction(async (tx) => {
        // Revoke previous links
        await tx.magicLink.updateMany({
            where: { clientId, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        // Create new link
        await tx.magicLink.create({
            data: {
                clientId,
                tokenHash,
                expiresAt,
            },
        });
    });

    writeAuditLog({
        userId,
        action: "LINK_GENERATED",
        entity: "MagicLink",
        entityId: clientId,
    });

    await recomputeClientStatus(clientId);

    return {
        url: buildMagicLinkUrl(rawToken),
        expiresAt,
    };
}

export async function revokeLink(userId: string, clientId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    await prisma.magicLink.updateMany({
        where: { clientId, revokedAt: null },
        data: { revokedAt: new Date() },
    });

    await prisma.client.update({
        where: { id: clientId },
        data: { status: ClientStatus.CLOSED },
    });

    writeAuditLog({
        userId,
        action: "LINK_REVOKED",
        entity: "MagicLink",
        entityId: clientId,
    });

    return { message: "Magic link revoked successfully" };
}

export async function restoreLink(userId: string, clientId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
        include: {
            links: { orderBy: { createdAt: "desc" }, take: 1 },
        },
    });

    if (!client) {
        throw new AppError("Client not found", 404);
    }

    const latestLink = client.links[0];
    if (latestLink) {
        await prisma.magicLink.update({
            where: { id: latestLink.id },
            data: { revokedAt: null },
        });
    }

    writeAuditLog({
        userId,
        action: "LINK_RESTORED",
        entity: "MagicLink",
        entityId: clientId,
    });

    await recomputeClientStatus(clientId);

    return { message: "Magic link restored successfully" };
}

export async function nudgeClient(userId: string, clientId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    const client = await prisma.client.findFirst({
        where: { id: clientId, ownerId: userId },
        include: {
            links: { orderBy: { createdAt: "desc" }, take: 1 },
        },
    });

    if (!client || !user) {
        throw new AppError("Client not found", 404);
    }

    const link = client.links[0];
    if (!link || link.revokedAt || link.expiresAt < new Date()) {
        throw new AppError(
            "No active magic link found for client. Please regenerate.",
            400,
        );
    }

    // Stamp nudgedAt
    await prisma.magicLink.update({
        where: { id: link.id },
        data: { nudgedAt: new Date() },
    });

    writeAuditLog({
        userId,
        action: "NUDGE_SENT",
        entity: "Client",
        entityId: clientId,
    });

    // Format phone number (digits only for wa.me)
    const cleanPhone = client.phone.replace(/[^0-9]/g, "");
    const firmTitle = user.firmName || user.name;
    const appBaseUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3001";
    const text = `Hello ${client.name}, this is a gentle reminder from ${firmTitle} regarding your ${client.matterType} matter. Please upload the pending documents to your secure portal: ${appBaseUrl}/portal/${link.id}`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

    return {
        nudgeUrl: waUrl,
        nudgedAt: new Date().toISOString(),
    };
}
