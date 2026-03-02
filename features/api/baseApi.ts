import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/', // Use relative paths for Next.js API routes
  }),
  tagTypes: ['User', 'Auth'],
  endpoints: () => ({}),
});

