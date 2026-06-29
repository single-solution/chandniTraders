import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
	level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
	redact: {
		paths: [
			"password",
			"*.password",
			"credentials.password",
			"user.password",
			"*.passwordHash",
			"passwordHash",
			"token",
			"*.token",
			"authorization",
			"headers.authorization",
			"headers.cookie",
			"cookies",
			"AUTH_SECRET",
			"MONGODB_URI",
		],
		remove: true,
	},
	transport: isProduction
		? undefined
		: {
				target: "pino-pretty",
				options: {
					colorize: true,
					singleLine: true,
					translateTime: "SYS:HH:MM:ss",
					ignore: "pid,hostname",
				},
			},
});
