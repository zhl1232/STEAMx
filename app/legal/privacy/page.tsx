import type { Metadata } from "next";
import Link from "next/link";

import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { BRAND_FULL_NAME } from "@/lib/brand";

const PRIVACY_VERSION = "v2026.03";
const EFFECTIVE_DATE = "2026 年 3 月 20 日";

export const metadata: Metadata = {
  title: "隐私政策",
  description: `${BRAND_FULL_NAME}平台隐私政策，说明我们收集的信息范围、使用方式、共享边界与您的数据权利。`,
};

const sections = [
  {
    title: "一、我们收集的信息",
    paragraphs: [
      `当您注册、登录或使用${BRAND_FULL_NAME}时，我们会收集完成账号识别、内容发布与安全保障所必需的信息，包括手机号、账号标识、基础资料、设备与日志信息。`,
      "当您发布项目、评论、回复、参与挑战、发送消息或进行打赏时，平台会记录相关内容、操作时间、互动对象与必要的交易流水，用于展示功能结果、处理纠纷与防范滥用。",
    ],
  },
  {
    title: "二、信息的使用方式",
    paragraphs: [
      "我们将信息用于账号登录与身份验证、内容展示与推荐、项目审核、消息通知、挑战与积分功能、风控限流、故障排查以及改进产品体验。",
      "如法律法规要求，或为保障用户、平台及公众的合法权益，我们可能在必要范围内使用相关信息进行安全审计、违规调查与证据留存。",
    ],
  },
  {
    title: "三、信息共享与披露",
    paragraphs: [
      "除以下情形外，我们不会向第三方出售您的个人信息：获得您的明确同意、为完成服务而由受托服务提供方处理、履行法定义务，或为保护未成年人及平台安全所必需。",
      "当使用云存储、短信发送、支付或分析服务时，我们会要求合作方仅在实现对应业务目的所必需的范围内处理信息，并采取相应的安全与保密措施。",
    ],
  },
  {
    title: "四、存储与安全",
    paragraphs: [
      "我们会采取访问控制、日志审计、传输加密、频率限制等合理措施保护您的信息，尽力降低未经授权访问、泄露、篡改或丢失的风险。",
      "互联网环境并非绝对安全。如发生可能影响您权益的安全事件，我们将按照法律法规要求及时告知事件基本情况、影响范围、处置措施与建议。",
    ],
  },
  {
    title: "五、您的权利",
    paragraphs: [
      "您可以通过平台提供的资料设置、隐私设置或账号安全功能，访问、更正或更新您的个人资料；在符合法律法规和平台规则的前提下，您也可以申请删除相关内容或注销账号。",
      "如您对隐私政策或个人信息处理存在疑问、投诉或建议，可通过平台公示的客服与反馈渠道联系我们，我们会在合理期限内处理。",
    ],
  },
  {
    title: "六、未成年人保护与政策更新",
    paragraphs: [
      "如您为未成年人，建议在监护人指导下阅读本政策并使用平台服务。我们会结合未成年人保护要求，采取必要的内容审核、权限控制与风险防护措施。",
      "本政策可能根据业务变化、法律法规或监管要求进行更新。更新后的版本将在平台公示，并自标注的生效日期起施行；继续使用平台服务即表示您理解并接受更新后的政策。",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="page-shell pt-0 pb-24 md:pt-6 md:pb-10">
      <MobilePageHeader
        title="隐私政策"
        fallbackHref="/settings/about"
        className="md:hidden"
      />

      <div className="mx-auto max-w-3xl">
        <section className="surface-panel overflow-hidden border-[hsl(var(--surface-border)/0.68)] shadow-none">
          <div className="hidden border-b border-border/60 bg-[hsl(var(--surface-muted)/0.56)] px-6 py-6 md:block">
            <p className="section-kicker">规则说明</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">隐私政策</h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>版本：{PRIVACY_VERSION}</span>
              <span>生效日期：{EFFECTIVE_DATE}</span>
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="rounded-md bg-[hsl(var(--surface-muted)/0.46)] p-4 sm:p-5">
              <p className="text-sm font-medium text-foreground">{BRAND_FULL_NAME}隐私政策</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground md:hidden">
                <p>版本：{PRIVACY_VERSION}</p>
                <p>生效日期：{EFFECTIVE_DATE}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                本政策说明 {BRAND_FULL_NAME} 如何收集、使用、存储、共享和保护您的个人信息。与账号、发布、互动、消息、通知和交易相关的处理规则，应与
                <Link href="/legal/terms" className="mx-1 text-primary hover:underline">
                  《用户协议》
                </Link>
                一并阅读。
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
