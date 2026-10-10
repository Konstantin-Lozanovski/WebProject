import nodemailer from "nodemailer";
import {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,
} from "../config/env.js";
import { TIME_ZONE } from "../models/game.model.js";

// The only file that knows how an email is sent. The controllers call one
// of the four functions at the bottom and never see nodemailer.

const APP_NAME = "Pickup Game Organizer";

// How long a send may take before it counts as failed. Without it a mail
// port that the host blocks would keep the send waiting for two minutes.
const TIMEOUT = 10 * 1000;

// Stays null when there are no mail settings, as on a machine that only
// runs docker-compose; sendEmail then writes the email to the server log
let transporter = null;

if (MAIL_HOST && MAIL_USER && MAIL_PASS && MAIL_FROM) {
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: TIMEOUT,
  });
} else if (MAIL_HOST || MAIL_USER || MAIL_PASS || MAIL_FROM) {
  // Some settings but not all: said out loud, because otherwise the emails
  // would quietly go to the log and look like a problem at the provider
  console.warn(
    "Mail settings are incomplete (MAIL_HOST, MAIL_USER, MAIL_PASS and MAIL_FROM are all needed), so emails are written to the log",
  );
}

// A send that fails is only logged and never throws: an email is an extra,
// so the action that caused it still succeeds. That is also why the
// controllers call the functions below without await: the response does not
// wait for the mail provider.
const sendEmail = async (to, subject, text) => {
  if (!transporter) {
    console.log(
      `Email (not sent, no mail settings)\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`,
    );
    return;
  }

  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text });
  } catch (error) {
    console.error(
      `Could not send the email "${subject}" to ${to}:`,
      error.message,
    );
  }
};

// "Monday 12 October 2026 at 18:30": the start as the players see it on
// their clocks in Macedonia, not on the clock of the server
const formatStartTime = (startTime) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  });
  return formatter.format(startTime);
};

// The lines that name a game in an email
const describeGame = (game) => {
  return `Sport: ${game.sport}
City: ${game.city}
Venue: ${game.venue}
Start time: ${formatStartTime(game.startTime)}`;
};

export const sendWelcomeEmail = (user) => {
  const text = `Hi ${user.username},

Welcome to ${APP_NAME}. You can now create your own games and send join requests for the games of others.`;

  return sendEmail(user.email, `Welcome to ${APP_NAME}`, text);
};

// user is the one who sent the join request
export const sendJoinRequestEmail = (organizer, user, game) => {
  const text = `Hi ${organizer.username},

${user.username} sent a join request for your game:

${describeGame(game)}

Open the game in ${APP_NAME} to accept or decline it.`;

  const subject = `${user.username} wants to join your game`;
  return sendEmail(organizer.email, subject, text);
};

export const sendAcceptedEmail = (user, game) => {
  const text = `Hi ${user.username},

Your join request was accepted, so you are now a player in this game:

${describeGame(game)}`;

  const subject = `You're in: ${game.sport} in ${game.city}`;
  return sendEmail(user.email, subject, text);
};

// For one player of a game that was cancelled or deleted
export const sendGameCancelledEmail = (user, game) => {
  const text = `Hi ${user.username},

A game you were a player in was cancelled and will not take place:

${describeGame(game)}`;

  const subject = `Your game was cancelled: ${game.sport} in ${game.city}`;
  return sendEmail(user.email, subject, text);
};
