import type { Request, Response } from "express";

export default async function handler(request: Request, response: Response) {
  try {
    const { default: app } = await import("../server/src/index.js");
    return app(request, response);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "服务初始化失败，请稍后重试" });
  }
}
