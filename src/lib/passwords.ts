export function validatePasswordChange(current: string, next: string, confirmation: string) {
  if (!current) return '현재 비밀번호를 입력해 주세요.';
  if (next.length < 8) return '새 비밀번호는 8자 이상으로 입력해 주세요.';
  if (new TextEncoder().encode(next).length > 72) return '새 비밀번호가 너무 길어요. 영문·숫자 기준 72자 이내로 입력해 주세요.';
  if (current === next) return '현재 비밀번호와 다른 비밀번호를 입력해 주세요.';
  if (next !== confirmation) return '새 비밀번호가 서로 일치하지 않아요.';
  return null;
}
