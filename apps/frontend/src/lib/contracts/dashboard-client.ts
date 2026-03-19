import type { AxiosRequestConfig } from "axios";
import {
  dashboardLayoutResponseSchema,
  dashboardModuleCardsResponseSchema,
  dashboardPaths,
  systemDashboardQuerySchema,
  systemDashboardResponseSchemasByVersion,
  updateSystemDashboardLayoutBodySchema,
  type SystemDashboardQuery,
  type UpdateSystemDashboardLayoutBody,
} from "@contracts/dashboard";
import { API_CURRENT_VERSION } from "@contracts/http";
import api from "@/lib/api";
import {
  parseContractValue,
  parseVersionedContractValue,
  resolveApiVersionFromHeaders,
} from "@/lib/contracts/contract-runtime";

export async function getSystemDashboard(
  query: SystemDashboardQuery,
  config?: AxiosRequestConfig,
) {
  const params = parseContractValue(
    systemDashboardQuerySchema,
    query,
    dashboardPaths.aggregate,
    "request",
  );
  const response = await api.get(dashboardPaths.aggregate, {
    ...config,
    params,
  });
  const responseVersion = resolveApiVersionFromHeaders(response.headers);
  return parseVersionedContractValue(
    systemDashboardResponseSchemasByVersion,
    response.data,
    dashboardPaths.aggregate,
    "response",
    responseVersion,
    {
      expectedVersion: API_CURRENT_VERSION,
      allowVersionFallback: responseVersion == null,
    },
  );
}

export async function getSystemDashboardLayout(config?: AxiosRequestConfig) {
  const response = await api.get(dashboardPaths.layout, config);
  return parseContractValue(
    dashboardLayoutResponseSchema,
    response.data,
    dashboardPaths.layout,
    "response",
  );
}

export async function saveSystemDashboardLayout(
  input: UpdateSystemDashboardLayoutBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(
    updateSystemDashboardLayoutBodySchema,
    input,
    dashboardPaths.layout,
    "request",
  );
  const response = await api.put(dashboardPaths.layout, body, config);
  return parseContractValue(
    dashboardLayoutResponseSchema,
    response.data,
    dashboardPaths.layout,
    "response",
  );
}

export async function getSystemDashboardModuleCards(config?: AxiosRequestConfig) {
  const response = await api.get(dashboardPaths.moduleCards, config);
  return parseContractValue(
    dashboardModuleCardsResponseSchema,
    response.data,
    dashboardPaths.moduleCards,
    "response",
  );
}
