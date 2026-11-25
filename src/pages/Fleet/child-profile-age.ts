/**
 * 由生日（YYYY-MM-DD，date-only）换算周岁，按 Asia/Shanghai 日历日判断
 * 「今年生日是否已过」——孩子档案的「年龄」是与自然日绑定的口径，
 * 不能用运行环境的本地时区（CI 跑 UTC，本地 Asia/Shanghai，断言会翻）。
 *
 * @param birthday YYYY-MM-DD；非法格式/不存在的日期（如 2 月 30 日）返回 null
 * @param now 当前时间（测试注入固定值，避免断言依赖运行日期）
 */
export function calcAge(birthday: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])

  const birth = new Date(Date.UTC(year, month - 1, day))
  // 归一化会滚动溢出日期（2018-02-30 → 3 月 2 日），逐分量回验拒掉它
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    return null
  }

  // now 平移到 Asia/Shanghai（固定 +8，无 DST）再取日历分量
  const shanghai = new Date(now.getTime() + 8 * 3600_000)
  const nowYear = shanghai.getUTCFullYear()
  const nowMonth = shanghai.getUTCMonth()
  const nowDay = shanghai.getUTCDate()

  let age = nowYear - year
  if (nowMonth < month - 1 || (nowMonth === month - 1 && nowDay < day)) {
    age -= 1
  }
  return age >= 0 ? age : null
}
