import type { Metadata } from "next";
import Link from "next/link";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";

const TERMS_VERSION = "v2026.03";
const EFFECTIVE_DATE = "2026 年 3 月 20 日";

export const metadata: Metadata = {
  title: "用户协议",
  description: "STEAM 探索平台用户协议，说明服务范围、使用规范、内容处理与未成年人保护要求。",
};

const sections = [
  {
    title: "一、协议适用范围",
    paragraphs: [
      "本协议适用于您访问、注册、登录或使用 STEAM 探索平台及其相关服务的全部行为。您在完成注册、勾选同意，或继续使用平台服务时，即视为已阅读并接受本协议与《隐私政策》。",
      "如您不同意本协议任一条款，应立即停止注册、登录或继续使用平台服务。",
    ],
  },
  {
    title: "二、服务内容",
    paragraphs: [
      "STEAM 探索为青少年项目式学习提供项目浏览、发布、互动、讨论、挑战、消息和成长记录等功能。平台可根据运营需要调整具体功能、展示方式或服务范围。",
      "平台提供的内容、审核结果、推荐排序与活动安排，会根据安全、合规和产品策略进行更新，不构成对任何结果的保证。",
    ],
  },
  {
    title: "三、账号与使用规则",
    paragraphs: [
      "您应提供真实、合法、完整且可联系的注册信息，并妥善保管账号、验证码及其他身份凭证。因保管不当导致的风险与损失，由账号持有人自行承担。",
      "您不得利用平台从事违法违规、侵害他人权益、破坏平台安全或影响他人正常使用的行为，包括但不限于批量注册、刷量、绕过审核、发布违法或骚扰内容、恶意探测接口与系统。",
    ],
  },
  {
    title: "四、内容发布与处理",
    paragraphs: [
      "您对自行发布的项目、评论、回复、图片、视频及其他内容的合法性、准确性和完整性负责，并确保其不侵犯任何第三方的知识产权、隐私权、名誉权或其他合法权益。",
      "为保障社区安全与内容质量，平台有权依据规则对内容进行审核、下架、限流、删除，对账号采取提醒、限制功能、暂停使用或封禁等措施，并保留相关记录。",
    ],
  },
  {
    title: "五、未成年人保护",
    paragraphs: [
      "如您为未成年人，应在监护人指导下阅读、理解并同意本协议后使用平台服务。监护人应合理监督未成年人的注册、发布、互动和消费行为。",
      "平台将根据法律法规和产品规则采取必要的内容审核、权限控制与安全保护措施，但监护人仍应对未成年人的使用行为承担相应监护责任。",
    ],
  },
  {
    title: "六、责任限制与服务变更",
    paragraphs: [
      "在法律法规允许的范围内，平台将尽合理努力保障服务连续性与安全性，但不对因网络故障、第三方服务异常、不可抗力、系统维护或超出平台合理控制范围的情形导致的服务中断或数据损失承担责任。",
      "平台可根据法律法规、监管要求、业务调整或安全治理需要，对本协议进行更新。更新后的协议将在平台公示；继续使用服务即视为您接受更新后的协议。",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="page-shell pt-6 pb-24 md:pb-10">
      <MobilePageHeader
        title="用户协议"
        fallbackHref="/settings/about"
        className="-mx-4 -mt-6 mb-4 md:hidden"
      />

      <div className="mx-auto max-w-3xl">
        <section className="surface-panel overflow-hidden">
          <div className="hidden border-b border-border/60 bg-gradient-to-r from-primary/8 via-background to-secondary/20 px-6 py-6 md:block">
            <p className="section-kicker">规则说明</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">用户协议</h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>版本：{TERMS_VERSION}</span>
              <span>生效日期：{EFFECTIVE_DATE}</span>
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="surface-subtle p-4">
              <p className="text-sm font-medium text-foreground">STEAM 探索用户协议</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground md:hidden">
                <p>版本：{TERMS_VERSION}</p>
                <p>生效日期：{EFFECTIVE_DATE}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                本协议是您与 STEAM 探索之间就平台服务使用、内容发布、互动行为与账号管理所达成的约定。与账号注册、登录、发布、评论、互动等功能相关的处理规则，均以本协议及
                <Link href="/legal/privacy" className="mx-1 text-primary hover:underline">
                  《隐私政策》
                </Link>
                为准。
              </p>
            </div>

            <div className="mt-8 space-y-8">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                  <div className="mt-3 space-y-3">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
