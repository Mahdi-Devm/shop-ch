type ValidationIssues = { issues?: { message: string }[] } | null | undefined;

export function formatZodErrors(errors: ValidationIssues) {
  const firstIssue = errors?.issues?.[0];
  if (firstIssue) {
    return `${firstIssue.message}`;
  } else {
    return "خطا در اعتبارسنجی فرم";
  }
}
