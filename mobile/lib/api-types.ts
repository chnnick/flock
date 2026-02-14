/**
 * API request/response types — mirror FastAPI (Beanie) models.
 * Source of truth: api/src/db/models/user.py and api/src/users/schemas.py
 */

export interface ApiUser {
  id: string;
  auth0_id: string;
  name: string;
  occupation: string;
  gender: string;
  interests: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiUserCreate {
  name: string;
  occupation: string;
  gender: string;
  interests: string[];
}

export interface ApiUserUpdate {
  name?: string;
  occupation?: string;
  gender?: string;
  interests?: string[];
}
