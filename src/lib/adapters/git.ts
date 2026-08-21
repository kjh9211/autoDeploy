import simpleGit from "simple-git";

export type GitUpdateCheck =
  | {
      ok: true;
      dirtyFiles: string[]; // uncommitted local changes — must block a pull, see §6.4
      ahead: number;
      behind: number;
      changedFiles: string[]; // files that differ between HEAD and origin/<branch>
      touchesPackageJson: boolean;
      touchesSchemaSql: boolean;
    }
  | { ok: false; error: string };

// On-demand only (called from an explicit "업데이트 확인" action, never on a
// plain page load) — it runs `git fetch`, a real network call against the
// app's remote. docs/PLANNING.md §6.4.
export async function checkForAppUpdates(
  localPath: string,
  branch: string,
): Promise<GitUpdateCheck> {
  const git = simpleGit(localPath);

  try {
    if (!(await git.checkIsRepo())) {
      return { ok: false, error: `git 저장소가 아닙니다: ${localPath}` };
    }

    const status = await git.status();
    const dirtyFiles = status.files.map((f) => f.path);

    await git.fetch(["origin", branch]);

    const counts = await git.raw([
      "rev-list",
      "--left-right",
      "--count",
      `HEAD...origin/${branch}`,
    ]);
    const [aheadStr, behindStr] = counts.trim().split(/\s+/);

    const diffOutput = await git.diff([
      "--name-only",
      `HEAD..origin/${branch}`,
    ]);
    const changedFiles = diffOutput.split("\n").filter(Boolean);

    return {
      ok: true,
      dirtyFiles,
      ahead: Number(aheadStr ?? 0),
      behind: Number(behindStr ?? 0),
      changedFiles,
      touchesPackageJson: changedFiles.includes("package.json"),
      touchesSchemaSql: changedFiles.some((f) => f.endsWith("schema.sql")),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
