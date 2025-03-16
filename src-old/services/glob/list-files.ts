import fg from "fast-glob"
import os from "os"
import * as path from "path"
import { arePathsEqual } from "../../utils/path"

/**
 * Lists files in a directory with safety checks for root and home directories.
 *
 * @param dirPath - The directory path to list files from
 * @param recursive - Whether to list files recursively in subdirectories
 * @param limit - Maximum number of files to return
 * @returns A tuple containing [array of file paths, boolean indicating if limit was reached]
 * @throws Will throw an error if the globbing process times out (via internal globbyLevelByLevel function)
 *
 * @example
 * ```typescript
 * // List up to 100 files in the current directory (non-recursive)
 * const [files, limitReached] = await listFiles('.', false, 100);
 *
 * // List up to 1000 files recursively
 * const [allFiles, hitLimit] = await listFiles('./src', true, 1000);
 * ```
 */
export async function listFiles(dirPath: string, recursive: boolean, limit: number): Promise<[string[], boolean]> {
	const absolutePath = path.resolve(dirPath)
	// Do not allow listing files in root or home directory, which cline tends to want to do when the user's prompt is vague.
	const root = process.platform === "win32" ? path.parse(absolutePath).root : "/"
	const isRoot = arePathsEqual(absolutePath, root)
	if (isRoot) {
		return [[root], false]
	}
	const homeDir = os.homedir()
	const isHomeDir = arePathsEqual(absolutePath, homeDir)
	if (isHomeDir) {
		return [[homeDir], false]
	}

	const dirsToIgnore = [
		"node_modules",
		"__pycache__",
		"env",
		"venv",
		"target/dependency",
		"build/dependencies",
		"dist",
		"out",
		"bundle",
		"vendor",
		"tmp",
		"temp",
		"deps",
		"pkg",
		"Pods",
		".*", // '!**/.*' excludes hidden directories, while '!**/.*/**' excludes only their contents. This way we are at least aware of the existence of hidden directories.
	].map((dir) => `**/${dir}/**`)

	const options = {
		cwd: dirPath,
		dot: true, // do not ignore hidden files/directories
		absolute: true,
		markDirectories: true, // Append a / on any directories matched (/ is used on windows as well, so dont use path.sep)
		gitignore: recursive, // fast-glob also supports gitignore
		ignore: recursive ? dirsToIgnore : undefined, // just in case there is no gitignore, we ignore sensible defaults
		onlyFiles: false, // true by default, false means it will list directories on their own too
	}
	// * globs all files in one dir, ** globs files in nested directories
	const files = recursive ? await globbyLevelByLevel(limit, options) : (await fg("*", options)).slice(0, limit)
	return [files, files.length >= limit]
}

/**
 * Performs breadth-first traversal of directory structure level by level up to a limit.
 *
 * Features:
 * - Queue-based approach ensures proper breadth-first traversal
 * - Processes directory patterns level by level
 * - Captures a representative sample of the directory structure up to the limit
 * - Minimizes risk of missing deeply nested files
 *
 * @param limit - Maximum number of files to return
 * @param options - Options to pass to fast-glob
 * @returns Array of file paths up to the specified limit
 * @throws Will throw an error if the globbing process times out (after 10 seconds)
 *
 * Notes:
 * - Relies on fast-glob to mark directories with /
 * - Potential for loops if symbolic links reference back to parent
 * - Timeout mechanism prevents infinite loops
 */
async function globbyLevelByLevel(limit: number, options?: fg.Options) {
	let results: Set<string> = new Set()
	let queue: string[] = ["*"]

	const globbingProcess = async () => {
		while (queue.length > 0 && results.size < limit) {
			const pattern = queue.shift()!
			const filesAtLevel = await fg(pattern, options)

			for (const file of filesAtLevel) {
				if (results.size >= limit) {
					break
				}
				results.add(file)
				if (file.endsWith("/")) {
					queue.push(`${file}*`)
				}
			}
		}
		return Array.from(results).slice(0, limit)
	}

	// Timeout after 10 seconds and return partial results
	const timeoutPromise = new Promise<string[]>((_, reject) => {
		setTimeout(() => reject(new Error("Globbing timeout")), 10_000)
	})
	try {
		return await Promise.race([globbingProcess(), timeoutPromise])
	} catch (error) {
		console.warn("Globbing timed out, returning partial results")
		return Array.from(results)
	}
}
