import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalString = () => z.preprocess(emptyToUndefined, z.string().optional());

// Shared by /apps/new and /apps/[id]'s edit form — both post the same fields,
// the latter just adds an `id`.
export const appFormBaseSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  type: z.enum(["node_app", "static_web", "discord_bot", "minecraft"]),
  runtime: z.enum(["pm2", "nssm"]),
  pm2Name: optionalString(),
  nssmService: optionalString(),
  localPath: optionalString(),
  branch: optionalString(),
  domain: optionalString(),
  logPath: optionalString(),
  buildCmd: optionalString(),
  migrateCmd: optionalString(),
  deployCommandsCmd: optionalString(),
  commandsPath: optionalString(),
  healthcheckUrl: optionalString(),
  notes: optionalString(),
});

export function withRuntimeRefinements<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
) {
  return schema
    .refine((v) => (v.runtime === "pm2" ? !!v.pm2Name : true), {
      message: "PM2로 관리되는 앱은 pm2 프로세스 이름이 필요합니다.",
      path: ["pm2Name"],
    })
    .refine((v) => (v.runtime === "nssm" ? !!v.nssmService : true), {
      message: "NSSM으로 관리되는 앱은 서비스 이름이 필요합니다.",
      path: ["nssmService"],
    });
}
