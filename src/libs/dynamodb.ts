// src/libs/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

const config = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  region: process.env.AWS_REGION
}

export const dynamoDBClient = new DynamoDBClient(config)
