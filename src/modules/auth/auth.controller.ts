import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const result = await authService.loginUser(req.body);
        const isProd = process.env.NODE_ENV === "production";
        res.cookie("auth_token", result.token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge: authService.getCookieMaxAge(),
            path: "/",
        });
        res.status(200).json({ user: result.user });
    } catch (err) {
        next(err);
    }
};

export const authMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const user = await authService.getAuthUser(req);
        res.status(200).json(user);
    } catch (err) {
        next(err);
    }
};

export const logout = (_req: Request, res: Response): void => {
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
    });
    res.status(200).json({ message: "Logged out successfully" });
};

export const createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const user = await authService.createUser(req.body, req.user?.userId);
        res.status(201).json(user);
    } catch (err) {
        next(err);
    }
};

export const updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.params["userId"];
        if (!userId) {
            res.status(400).json({ error: "User ID is required" });
            return;
        }
        const updated = await authService.updateUser(
            userId,
            req.body,
            req.user?.userId,
        );
        res.status(200).json(updated);
    } catch (err) {
        next(err);
    }
};

export const updateFirm = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const updated = await authService.updateFirmSettings(
            req.user.userId,
            req.body,
        );
        res.status(200).json(updated);
    } catch (err) {
        next(err);
    }
};

export const toggleUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.params["userId"];
        if (!userId) {
            res.status(400).json({ error: "User ID is required" });
            return;
        }
        const updated = await authService.toggleUserActive(
            userId,
            req.user?.userId,
        );
        res.status(200).json(updated);
    } catch (err) {
        next(err);
    }
};

export const deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.params["userId"];
        if (!userId) {
            res.status(400).json({ error: "User ID is required" });
            return;
        }
        const result = await authService.deleteUser(userId, req.user?.userId);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

export const getAllUsers = async (
    _req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const users = await authService.getAllUsers();
        res.status(200).json(users);
    } catch (err) {
        next(err);
    }
};
