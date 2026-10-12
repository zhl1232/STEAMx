import Link from "next/link";
import { ArrowRight, Compass, MessageCircle, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildPageMetadata } from "@/lib/seo/metadata";

import styles from "./membership.module.css";

export const metadata = buildPageMetadata({
  title: "探索会员 · 服务说明",
  description: "了解创探空间探索会员提供的 AI 辅助权益、19.9 元 / 30 天月卡方案、开通与售后安排。免费课程继续免费。",
  path: "/membership",
});

export default function MembershipPage() {
  return (
    <article className={`app-shell-wide ${styles.page}`} aria-labelledby="membership-title">
      <nav aria-label="面包屑" className={styles.breadcrumb}>
        <Link href="/">创探空间</Link><span aria-hidden="true">/</span><span>会员服务说明</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}><Compass size={18} aria-hidden="true" /> 探索 · 创造 · 成长</p>
          <h1 id="membership-title">探索会员</h1>
          <p className={styles.lead}>让好奇心，多一份 AI 辅助。</p>
          <p className={styles.description}>从向小迪提问，到梳理项目思路，为自主探索提供更多站内 AI 使用额度。孩子动手尝试，AI 帮忙启发。</p>
          <div className={styles.actions}>
            <Button asChild tone="brand" size="lg"><Link href="/explore">继续免费探索 <ArrowRight size={16} aria-hidden="true" /></Link></Button>
            <Link href="#service" className={styles.textLink}>了解服务与售后</Link>
          </div>
        </div>

        <section className={styles.plan} aria-labelledby="plan-title">
          <h2 id="plan-title">探索会员月卡</h2>
          <p className={styles.price}><strong>¥19.9</strong><span>/ 30 天</span></p>
          <p>自实际开通时起连续计算 30 天</p>
          <dl className={styles.facts}>
            <div><dt>AI 代币</dt><dd>1500 代币 / 购买周期</dd></div>
            <div><dt>购买方式</dt><dd>单次购买，不自动续费</dd></div>
            <div><dt>交付方式</dt><dd>网站账号权益，无实物物流</dd></div>
          </dl>
        </section>
      </header>

      <section className={styles.benefits} aria-labelledby="benefits-title">
        <div>
          <p className={styles.eyebrow}>会员权益</p>
          <h2 id="benefits-title">把额度用在探索中</h2>
          <p className={styles.description}>1500 代币用于站内 AI 辅助，覆盖同一个 30 天购买周期。</p>
        </div>
        <div className={styles.benefitList}>
          <div><MessageCircle aria-hidden="true" /><div><h3>和小迪一起想一想</h3><p>使用小迪 AI 辅助问答，围绕探索中的问题获得解释与启发。代币用于理解问题、准备资料和生成回答，本次扣费会在回复后显示。</p></div></div>
          <div><Compass aria-hidden="true" /><div><h3>为 PBL 项目理清思路</h3><p>使用项目式学习中的 AI 辅导工具，辅助拆解问题、整理草稿和获得反馈，按对应工具规则扣减额度。</p></div></div>
        </div>
      </section>

      <section className={styles.rules} aria-labelledby="rules-title">
        <h2 id="rules-title">额度怎样使用</h2>
        <ul>
          <li>每个购买周期共 1500 代币，跨自然月不重复发放。</li>
          <li>余额仅在当前周期有效，不累积到下一周期；仅供站内使用，不折现。</li>
          <li>不产生超额扣款，到期后是否再次购买由你决定。</li>
          <li>购买前和使用时展示扣减规则与余额。</li>
        </ul>
      </section>

      <section className={styles.free} aria-labelledby="free-title">
        <Sprout aria-hidden="true" />
        <div><h2 id="free-title">免费课程，继续免费</h2><p>会员是额外的 AI 辅助选择。免费课程继续公开可用，不需要购买会员。</p></div>
        <Link href="/courses" className={styles.textLink}>去看免费课程 <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>

      <section id="service" className={styles.service} aria-labelledby="service-title">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>服务安排</p><h2 id="service-title">开通、使用与售后</h2><p>购买由家长或其他成年用户完成。</p></div>
        <div className={styles.serviceGrid}>
          <section aria-labelledby="delivery-title"><span className={styles.number} aria-hidden="true">01</span><h3 id="delivery-title">人工开通，账号交付</h3><p>付款成功并核对网站账号后，在 24 小时内人工开通。从实际开通时起计算有效期。</p><p>开通后可在账号会员信息中查看会员状态和到期日。</p></section>
          <section aria-labelledby="support-title"><span className={styles.number} aria-hidden="true">02</span><h3 id="support-title">站内反馈，站内回复</h3><p>通过网站现有「问题反馈」联系平台，回复会回到站内消息。</p><p>人工服务时间：工作日 9:00–18:00（北京时间），2 个工作日内首次回复。</p><Link href="/about#feedback" className={styles.textLink}>前往问题反馈 <ArrowRight size={16} aria-hidden="true" /></Link><p className={styles.caption}>提交反馈需要登录。</p></section>
          <section aria-labelledby="refund-title"><span className={styles.number} aria-hidden="true">03</span><h3 id="refund-title">退款有说明，也有时限</h3><p>付款后 7 日内，未使用会员付费权益的，可申请全额退款。</p><p>已使用或超过 7 日的，按实际已提供的服务核实，说明处理依据与可退金额，不因已经开通而一概拒绝退款。</p><p>确认退款后 5 个工作日内发起原路退款，到账以支付渠道处理为准。以上安排不限制消费者依法享有的权利。</p></section>
        </div>
      </section>

      <footer className={styles.operator}>
        <div><h2>服务经营主体</h2><p>北京创探科技有限公司</p><p>创探空间 · steam.bj.cn</p></div>
        <div><Link href="/about" className={styles.textLink}>了解创探空间 <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </footer>
    </article>
  );
}
