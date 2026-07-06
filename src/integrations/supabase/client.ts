export const supabase = {
  from: (table: string) => ({
    select: (query?: string) => ({
      eq: (col: string, val: any) => ({
        order: (col: string, opts?: any) => ({
          limit: (n: number) => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null })
        }),
        limit: (n: number) => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: null, error: null })
      }),
      order: (col: string, opts?: any) => ({
        limit: (n: number) => Promise.resolve({ data: [], error: null })
      }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (res: any) => Promise.resolve({ data: [], error: null })
    }),
    insert: (data: any) => ({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: null })
      })
    })
  }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  },
  functions: {
    invoke: async () => ({ data: null, error: null }),
  }
} as any;
