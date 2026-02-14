import { z } from "zod";

/**
 * Schemas for the FastAPI backend (MongoDB). Use these for API request/response typing.
 */
export const userResponseSchema = z.object({
  id: z.string(),
  auth0_id: z.string(),
  name: z.string(),
  occupation: z.string(),
  gender: z.string(),
  interests: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const userCreateSchema = z.object({
  name: z.string(),
  occupation: z.string(),
  gender: z.string(),
  interests: z.array(z.string()).default([]),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserCreate = z.infer<typeof userCreateSchema>;
