/**
 * Typed API client generated from the FastAPI OpenAPI schema (`make gen-api`).
 * Requests go to same-origin /api/* (proxied by Next) so the httpOnly cookie flows.
 */
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type Ticket = Schemas["TicketOut"];
export type PilotTicket = Schemas["PilotTicketOut"];
export type TicketDetail = Schemas["TicketDetailOut"];
export type PilotTicketDetail = Schemas["PilotTicketDetailOut"];
export type TimelineEvent = Schemas["TimelineEventOut"];
export type Link = Schemas["LinkOut"];
export type Me = Schemas["MeOut"];
export type DemoAccount = Schemas["DemoAccount"];
export type Sla = Schemas["SlaOut"];
export type Overview = Schemas["OverviewOut"];
export type Controller = Schemas["ControllerOut"];
export type Frequency = Schemas["FrequencyOut"];
export type Comment = Schemas["CommentOut"];
export type HandoffDiff = Schemas["HandoffDiffOut"];
export type Booking = Schemas["BookingOut"];
export type Suggest = Schemas["SuggestOut"];
export type IntentNode = Schemas["IntentNode"];
export type Insights = Schemas["InsightsOut"];

export const api = createClient<paths>({ baseUrl: "", credentials: "include" });

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Inner<D> = D extends { data: infer T } ? T : never;

/** Unwrap an openapi-fetch result: return `data.data` or throw an ApiError. */
export function unwrap<D>(result: { data?: D; error?: unknown; response: Response }): Inner<D> {
  if (result.data !== undefined) return (result.data as { data: Inner<D> }).data;
  const body = result.error as ApiErrorBody | undefined;
  throw new ApiError(
    result.response.status,
    body?.error?.code ?? "http_error",
    body?.error?.message ?? `Request failed (${result.response.status})`,
    body?.error?.details,
  );
}
