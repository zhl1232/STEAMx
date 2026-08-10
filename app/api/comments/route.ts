import { NextResponse } from 'next/server'

/**
 * POST /api/comments
 *
 * 项目评论已停止新增。历史评论仍可通过项目评论读取接口查看，
 * 留言、提问与建议统一发布到具体作品下。
 */
export async function POST() {
  return NextResponse.json(
    {
      error: '项目评论已停用，请到具体作品下留言',
      code: 'PROJECT_COMMENTS_RETIRED',
    },
    { status: 410 },
  )
}
