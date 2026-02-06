/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { db } from "@/lib/prisma";

const WELCOME_SUBJECT = "Welcome to Xessex!";

const WELCOME_BODY = `If you're tired of trying to watch adult content and having to go through a dozen videos to find one decent one, you've found your new source for porn!

We are literally made to solve that problem. All our videos are great quality, and on top of that we have a Ranking system that pays YOU for your valuable opinions.

Unlock more videos with the credits you earn and help us build a legendary organized porn list where we aim to discover the hottest video on the web!`;

export async function sendWelcomeMessage(userId: string) {
  try {
    await db.userMessage.create({
      data: {
        userId,
        senderId: null,
        type: "SYSTEM",
        subject: WELCOME_SUBJECT,
        body: WELCOME_BODY,
      },
    });
  } catch (err) {
    console.error("Failed to send welcome message:", err);
  }
}
