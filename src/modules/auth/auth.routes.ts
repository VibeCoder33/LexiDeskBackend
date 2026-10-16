import { Router } from "express";
import * as authController from "./auth.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { loginLimiter } from "../../middlewares/rateLimitter";
import {
    CreateUserSchema,
    LoginSchema,
    UpdateUserSchema,
    UpdateFirmSchema,
} from "./auth.schema";

const router = Router();

// Public
router.post(
    "/login",
    loginLimiter,
    validate(LoginSchema),
    authController.login,
);

// Authenticated
router.get("/me", authenticate, authController.authMe);
router.post("/logout", authController.logout);
router.patch(
    "/me/firm",
    authenticate,
    validate(UpdateFirmSchema),
    authController.updateFirm,
);

// SUPER admin only
router.get(
    "/users",
    authenticate,
    requireRole("SUPER"),
    authController.getAllUsers,
);
router.post(
    "/users",
    authenticate,
    requireRole("SUPER"),
    validate(CreateUserSchema),
    authController.createUser,
);
router.patch(
    "/users/:userId",
    authenticate,
    requireRole("SUPER"),
    validate(UpdateUserSchema),
    authController.updateUser,
);
router.patch(
    "/users/:userId/toggle",
    authenticate,
    requireRole("SUPER"),
    authController.toggleUser,
);
router.delete(
    "/users/:userId",
    authenticate,
    requireRole("SUPER"),
    authController.deleteUser,
);

export default router;
