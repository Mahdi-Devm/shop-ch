import { apiRequest, type ApiResult } from "@/core/lib/api/api-client";
import type { LoginResponse } from "../assets/@types/auth.types";

export function requestLogin(
  username: string,
  password: string,
): Promise<ApiResult<LoginResponse>> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
}
