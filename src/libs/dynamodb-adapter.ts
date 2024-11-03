// src/libs/dynamodb-adapter.ts
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import type { Adapter, AdapterUser, AdapterSession } from 'next-auth/adapters'

export function DynamoDBAdapter(client: DynamoDBClient): Adapter {
  const ddbDoc = DynamoDBDocument.from(client)
  const TableName = process.env.DYNAMODB_TABLE_NAME || 'next-auth'

  // Función auxiliar para convertir Items de DynamoDB a AdapterUser
  const itemToUser = (item: Record<string, any> | undefined): AdapterUser | null => {
    if (!item) return null

    return {
      id: item.id,
      email: item.email,
      emailVerified: item.emailVerified ? new Date(item.emailVerified) : null,
      name: item.name,
      image: item.image
    }
  }

  // Función auxiliar para convertir Items de DynamoDB a AdapterSession
  const itemToSession = (item: Record<string, any> | undefined): AdapterSession | null => {
    if (!item) return null

    return {
      sessionToken: item.sessionToken,
      userId: item.userId,
      expires: new Date(item.expires)
    }
  }

  const adapter: Adapter = {
    async createUser(user) {
      const newUser: AdapterUser = {
        id: crypto.randomUUID(),
        email: user.email!,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image
      }

      const Item = {
        pk: `USER#${user.email}`,
        sk: `PROFILE#${user.email}`,
        ...newUser,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await ddbDoc.put({ TableName, Item })

      return newUser
    },

    async getUser(id) {
      const { Items } = await ddbDoc.query({
        TableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': id }
      })

      return itemToUser(Items?.[0])
    },

    async getUserByEmail(email) {
      const { Items } = await ddbDoc.query({
        TableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${email}` }
      })

      return itemToUser(Items?.[0])
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const { Items } = await ddbDoc.query({
        TableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'providerAccountId = :paid AND provider = :p',
        ExpressionAttributeValues: {
          ':paid': providerAccountId,
          ':p': provider
        }
      })

      if (!Items?.[0]) return null

      const { Items: UserItems } = await ddbDoc.query({
        TableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${Items[0].userEmail}` }
      })

      return itemToUser(UserItems?.[0])
    },

    async updateUser(user) {
      const { Items } = await ddbDoc.query({
        TableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': user.id }
      })

      const existingUser = itemToUser(Items?.[0])

      if (!existingUser) throw new Error('User not found')

      const updatedUser: AdapterUser = {
        id: user.id,
        email: user.email || existingUser.email,
        emailVerified: user.emailVerified || existingUser.emailVerified,
        name: user.name || existingUser.name,
        image: user.image || existingUser.image
      }

      const Item = {
        pk: `USER#${updatedUser.email}`,
        sk: `PROFILE#${updatedUser.email}`,
        ...updatedUser,
        updatedAt: new Date().toISOString()
      }

      await ddbDoc.put({ TableName, Item })

      return updatedUser
    },

    async linkAccount(account) {
      const Item = {
        pk: `USER#${account.userId}`,
        sk: `ACCOUNT#${account.provider}`,
        ...account,
        createdAt: new Date().toISOString()
      }

      await ddbDoc.put({ TableName, Item })

      return account
    },

    async createSession(session) {
      const dbSession: AdapterSession = {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires
      }

      const Item = {
        pk: `SESSION#${session.sessionToken}`,
        sk: `USER#${session.userId}`,
        ...dbSession,
        createdAt: new Date().toISOString()
      }

      await ddbDoc.put({ TableName, Item })

      return dbSession
    },

    async getSessionAndUser(sessionToken) {
      const { Items } = await ddbDoc.query({
        TableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `SESSION#${sessionToken}` }
      })

      const session = itemToSession(Items?.[0])

      if (!session) return null

      const { Items: UserItems } = await ddbDoc.query({
        TableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': session.userId }
      })

      const user = itemToUser(UserItems?.[0])

      if (!user) return null

      return {
        session,
        user
      }
    },

    async updateSession(session) {
      const dbSession: AdapterSession = {
        sessionToken: session.sessionToken,
        userId: session.userId!,
        expires: session.expires!
      }

      const Item = {
        pk: `SESSION#${session.sessionToken}`,
        sk: `USER#${session.userId}`,
        ...dbSession,
        updatedAt: new Date().toISOString()
      }

      await ddbDoc.put({ TableName, Item })

      return dbSession
    },

    async deleteSession(sessionToken) {
      await ddbDoc.delete({
        TableName,
        Key: {
          pk: `SESSION#${sessionToken}`,
          sk: `SESSION#${sessionToken}`
        }
      })
    }
  }

  return adapter
}
