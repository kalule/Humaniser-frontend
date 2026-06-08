// Shared mutable reference for the in-memory access token.
// Written by authStore (login/logout/initialize), read by the Axios request
// interceptor. Using a ref avoids a circular ES-module import chain:
//   client.ts → authStore.ts → auth.ts → client.ts
export const tokenRef: { current: string | null } = { current: null }
