// src/libs/auth.ts
import CredentialProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

import { DynamoDBAdapter } from './dynamodb-adapter'
import { dynamoDBClient } from './dynamodb'

export const authOptions: NextAuthOptions = {
  adapter: DynamoDBAdapter(dynamoDBClient),
  providers: [
    CredentialProvider({
      name: 'Credentials',
      type: 'credentials',
      credentials: {},
      async authorize(credentials): Promise<User | null> {
        const { email, password } = credentials as { email: string; password: string }

        try {
          const res = await fetch(`${process.env.API_URL}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          })

          const data = await res.json()

          if (res.status === 401) {
            throw new Error(JSON.stringify(data))
          }

          if (res.status === 200) {
            const user: User = {
              id: data.id,
              name: data.name,
              email: data.email,
              image: data.image,
              role: data.role,
              status: data.status
            }

            return user
          }

          return null
        } catch (e: any) {
          throw new Error(e.message)
        }
      }
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/auth/error'
  },

  callbacks: {
    async jwt({ token, user, account }): Promise<JWT> {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.status = user.status
      }

      if (account) {
        token.accessToken = account.access_token
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.name = token.name || ''
        session.user.email = token.email || ''
      }

      if (token.accessToken) {
        session.accessToken = token.accessToken
      }

      return session
    }
  },

  events: {
    async signIn(message) {
      if (process.env.NODE_ENV === 'development') {
        console.log('signIn', message)
      }
    },
    async signOut(message) {
      if (process.env.NODE_ENV === 'development') {
        console.log('signOut', message)
      }
    }
  },

  debug: process.env.NODE_ENV === 'development'
}
