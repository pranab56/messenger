import { baseApi } from '../api/baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/api/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),
    signup: builder.mutation({
      query: (userData) => ({
        url: '/api/auth/signup',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['Auth'],
    }),
    verifyOtp: builder.mutation({
      query: (data) => ({
        url: '/api/auth/verify-otp',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Auth'],
    }),
    forgotPassword: builder.mutation({
      query: (data) => ({
        url: '/api/auth/forgot-password',
        method: 'POST',
        body: data,
      }),
    }),
    resetPassword: builder.mutation({
      query: (data) => ({
        url: '/api/auth/reset-password',
        method: 'POST',
        body: data,
      }),
    }),
    logout: builder.mutation({
      query: () => ({
        url: '/api/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
    getMe: builder.query({
      query: () => '/api/auth/me',
      providesTags: ['Auth'],
    }),
    updateProfile: builder.mutation({
      query: (data) => ({
        url: '/api/auth/me',
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Auth'],
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useVerifyOtpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useGetMeQuery,
  useUpdateProfileMutation
} = authApi;
