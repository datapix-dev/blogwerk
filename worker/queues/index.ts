import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

export const articleGenerationQueue = new Queue("article-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export const imageGenerationQueue = new Queue("image-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export const publishQueue = new Queue("publish", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})
