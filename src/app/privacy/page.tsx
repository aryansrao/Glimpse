import type { Metadata } from "next";
import { Navbar } from "@/components/home/navbar";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { absoluteUrl } from "@/lib/site";

const CONTACT_EMAIL = "abuse@glimpse-vc.vercel.app";
const LAST_UPDATED = "July 12, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Glimpse collects, uses, and protects your data.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/5 pt-6 first:border-t-0 first:pt-0">
      <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-mist">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 px-6 py-10 sm:px-10">
        <GlimpseOrb className="-z-10" />
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-medium">Privacy Policy</h1>
          <p className="mt-2 text-sm text-mist-dim">Last updated: {LAST_UPDATED}</p>

          <GlassCard strong className="mt-8 space-y-6 p-8 sm:p-10">
            <Section title="1. Overview">
              <p>
                This Privacy Policy explains what information Glimpse
                collects when you use our video calling, matchmaking, and
                persistent chatroom features, why we collect it, and who we
                share it with. Glimpse is operated by an individual developer
                (publicly known as aryansrao), not a registered company.
              </p>
            </Section>

            <Section title="2. Information we collect">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Account/OAuth data:</strong> when you sign in with
                  Discord or GitHub, we receive your name, email address, and
                  a provider account ID from that provider.
                </li>
                <li>
                  <strong>Profile data:</strong> anything you add to your
                  profile — avatar image, bio, interest tags, and your chosen
                  handle.
                </li>
                <li>
                  <strong>Chat &amp; call activity:</strong> messages you send
                  in persistent chatrooms, and metadata about calls you join
                  (such as room codes, timestamps, and participant handles).
                  We do not record or store the audio/video content of calls.
                </li>
                <li>
                  <strong>Uploaded media:</strong> images, video, or files you
                  upload to chatrooms or your profile.
                </li>
                <li>
                  <strong>Technical data:</strong> basic request metadata
                  (such as IP address at the time of a request) used for
                  abuse prevention and rate limiting.
                </li>
              </ul>
              <p>
                <strong>A note on call privacy:</strong> Glimpse calls are
                relayed through LiveKit&rsquo;s media server (SFU) rather than
                connecting participants&rsquo; devices directly to each other.
                This means your IP address is <strong>not</strong> exposed to
                the other person on a call — only to the media relay
                infrastructure that carries the encrypted stream.
              </p>
            </Section>

            <Section title="3. How we use your information">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>To create and maintain your account and public profile.</li>
                <li>To operate calls, matchmaking, and persistent chatrooms.</li>
                <li>To power discovery/search of public profiles by tag or name.</li>
                <li>To detect, investigate, and prevent abuse, spam, and violations of our Terms of Service.</li>
                <li>To respond to support requests and legal process.</li>
              </ul>
              <p>We do not sell your personal information.</p>
            </Section>

            <Section title="4. Third-party processors">
              <p>
                We rely on the following third parties to operate Glimpse.
                Each processes a limited slice of your data solely to provide
                their service to us:
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><strong>Discord / GitHub</strong> — OAuth sign-in providers.</li>
                <li><strong>LiveKit</strong> — real-time media relay (SFU) for video/audio calls.</li>
                <li><strong>Vercel</strong> — application hosting and edge network.</li>
                <li><strong>Turso</strong> — our libSQL database, storing accounts, profiles, chatrooms, and messages.</li>
                <li><strong>Vercel Blob</strong> — storage for uploaded media (images, video, files).</li>
              </ul>
            </Section>

            <Section title="5. Cookies and session tokens">
              <p>
                Glimpse uses a single session cookie set by NextAuth
                (next-auth) containing a signed JWT that identifies you while
                signed in. We do not use third-party advertising or tracking
                cookies.
              </p>
            </Section>

            <Section title="6. Data retention">
              <p>
                We retain account, profile, and chatroom data for as long as
                your account is active. Chat messages persist as part of the
                chatroom history unless deleted by you, a room moderator, or
                us. If you stop using Glimpse, your data remains until you
                request deletion (see Section 7).
              </p>
            </Section>

            <Section title="7. Your rights">
              <p>
                You can access and edit most of your profile data (avatar,
                bio, tags, visibility) directly from your account settings at
                any time. Account deletion is not yet self-service — to
                request access to, correction of, or deletion of your data,
                email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink">
                  {CONTACT_EMAIL}
                </a>{" "}
                and we will action the request as soon as reasonably
                possible.
              </p>
            </Section>

            <Section title="8. Children's privacy">
              <p>
                Glimpse is not directed at, and must not be used by, anyone
                under 16 years old, consistent with the age requirement in
                our Terms of Service. We do not knowingly collect personal
                information from children under 16. If you believe a child
                under 16 is using Glimpse, contact{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink">
                  {CONTACT_EMAIL}
                </a>{" "}
                and we will investigate and remove the account.
              </p>
            </Section>

            <Section title="9. International users">
              <p>
                Glimpse is hosted on infrastructure that may process and
                store data in multiple regions/countries via our providers
                (Vercel, Turso, LiveKit). By using Glimpse, you understand
                that your information may be transferred to and processed in
                countries other than your own, which may have different data
                protection laws.
              </p>
            </Section>

            <Section title="10. Changes to this policy">
              <p>
                We may update this Privacy Policy from time to time. Material
                changes will be reflected in the &ldquo;Last updated&rdquo;
                date above. Continued use of Glimpse after an update means you
                accept the revised policy.
              </p>
            </Section>

            <Section title="11. Contact">
              <p>
                Questions about this Privacy Policy, or requests regarding
                your data, can be sent to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
