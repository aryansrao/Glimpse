import type { Metadata } from "next";
import { Navbar } from "@/components/home/navbar";
import { GlassCard } from "@/components/glass/glass-card";
import { GlimpseOrb } from "@/components/glass/glimpse-orb";
import { absoluteUrl } from "@/lib/site";

const CONTACT_EMAIL = "abuse@glimpse-vc.vercel.app";
const LAST_UPDATED = "July 12, 2026";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Glimpse.",
  alternates: { canonical: absoluteUrl("/terms") },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/5 pt-6 first:border-t-0 first:pt-0">
      <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-mist">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="relative flex-1 px-6 py-10 sm:px-10">
        <GlimpseOrb className="-z-10" />
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-medium">Terms of Service</h1>
          <p className="mt-2 text-sm text-mist-dim">Last updated: {LAST_UPDATED}</p>

          <GlassCard strong className="mt-8 space-y-6 p-8 sm:p-10">
            <Section title="1. Acceptance of terms">
              <p>
                Glimpse (&ldquo;Glimpse,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is a video,
                audio, and text chat service, including persistent chatrooms and
                user-generated media, operated independently by an individual
                developer (&ldquo;the operator,&rdquo; publicly known as
                aryansrao) rather than a registered company. By creating an
                account, joining a call, joining or creating a chatroom, or
                otherwise using Glimpse, you agree to these Terms of Service
                (&ldquo;Terms&rdquo;). If you do not agree, do not use Glimpse.
              </p>
            </Section>

            <Section title="2. Age requirement">
              <p>
                You must be at least 16 years old to use Glimpse. By using the
                service you represent that you meet this minimum age
                requirement in your jurisdiction. If we learn that an account
                belongs to someone under 16, we will suspend or delete it.
              </p>
            </Section>

            <Section title="3. Your account">
              <p>
                Accounts are created via third-party sign-in (Discord or
                GitHub). You are responsible for the security of your
                connected account and for all activity that happens under
                your Glimpse account. You agree to provide accurate
                information in your profile (name, handle, bio, tags, avatar)
                and not to impersonate another person or organization.
              </p>
            </Section>

            <Section title="4. Prohibited conduct">
              <p>You agree not to use Glimpse to:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Harass, threaten, bully, stalk, or abuse another person, in
                  calls, chatrooms, or direct messages.
                </li>
                <li>
                  Upload, stream, or share illegal content, including but not
                  limited to content that infringes another person&rsquo;s
                  rights.
                </li>
                <li>
                  Create, upload, share, or solicit child sexual abuse
                  material (CSAM) in any form. We have{" "}
                  <strong>zero tolerance</strong> for this — any account found
                  doing so is permanently banned and reported to the National
                  Center for Missing &amp; Exploited Children (NCMEC) and/or
                  relevant law enforcement, without prior notice.
                </li>
                <li>
                  Send spam, unsolicited advertising, phishing links, or
                  malware, or run bots that automate calls, matchmaking, or
                  chatroom activity without our written permission.
                </li>
                <li>
                  Record, screenshot, or redistribute another participant&rsquo;s
                  video, audio, or messages without that participant&rsquo;s
                  consent (see Section 6).
                </li>
                <li>
                  Attempt to circumvent moderation, rate limits, age
                  requirements, or access controls, or to reverse-engineer or
                  disrupt the service.
                </li>
              </ul>
            </Section>

            <Section title="5. User-generated content and moderation">
              <p>
                You retain ownership of content you create, including profile
                information, chat messages, and uploaded media. By posting
                content on Glimpse you grant us a limited license to store,
                transmit, and display that content solely to operate the
                service (for example, relaying a chat message to other
                members of a room, or rendering your profile page).
              </p>
              <p>
                We may remove content, mute, suspend, or permanently ban any
                account, and may restrict or shut down any chatroom, at our
                sole discretion, with or without notice, if we believe it
                violates these Terms, applicable law, or puts other users at
                risk.
              </p>
            </Section>

            <Section title="6. Video and audio calls">
              <p>
                Glimpse calls are peer-to-peer or relayed through a real-time
                media server depending on network conditions, but are not
                recorded or stored by Glimpse itself. You must not record,
                capture, or otherwise preserve another participant&rsquo;s
                video, audio, or screen share without that participant&rsquo;s
                explicit, prior consent. Violating another participant&rsquo;s
                reasonable expectation of privacy during a call is grounds for
                immediate account termination.
              </p>
            </Section>

            <Section title="7. Media uploads, liability, and takedown requests">
              <p>
                You are solely responsible for media you upload to chatrooms
                or your profile. You represent that you own or have the
                necessary rights to any content you upload, and that it does
                not infringe any third party&rsquo;s intellectual property,
                privacy, or other rights.
              </p>
              <p>
                If you believe content on Glimpse infringes your copyright or
                other rights, send a takedown request to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink">
                  {CONTACT_EMAIL}
                </a>{" "}
                with (a) a description of the content and where it appears,
                (b) your contact information, and (c) a statement that you
                have a good-faith belief the use is unauthorized. We will
                review and remove infringing content we can verify.
              </p>
            </Section>

            <Section title="8. Termination">
              <p>
                We may suspend or terminate your access to Glimpse at any
                time, for any reason, including violation of these Terms. You
                may stop using Glimpse at any time. Sections of these Terms
                that by their nature should survive termination (including
                Sections 4, 7, 9, and 10) will survive.
              </p>
            </Section>

            <Section title="9. Disclaimer of warranties">
              <p>
                Glimpse is provided &ldquo;as is&rdquo; and &ldquo;as
                available,&rdquo; without warranties of any kind, express or
                implied, including merchantability, fitness for a particular
                purpose, and non-infringement. We do not guarantee that the
                service will be uninterrupted, secure, or error-free, or that
                other users will behave appropriately.
              </p>
            </Section>

            <Section title="10. Limitation of liability">
              <p>
                To the maximum extent permitted by law, the operator of
                Glimpse will not be liable for any indirect, incidental,
                special, consequential, or punitive damages, or any loss of
                data, arising from your use of, or inability to use, Glimpse,
                including content or conduct of any third party on the
                service.
              </p>
            </Section>

            <Section title="11. Changes to these terms">
              <p>
                We may update these Terms from time to time. If we make
                material changes, we will update the &ldquo;Last updated&rdquo;
                date above. Continued use of Glimpse after changes take effect
                constitutes acceptance of the revised Terms.
              </p>
            </Section>

            <Section title="12. Governing law">
              <p>
                These Terms are governed by the laws of{" "}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                  [Your jurisdiction]
                </span>
                , without regard to conflict-of-law principles. This
                placeholder should be filled in by the operator before
                relying on this document in a legal dispute.
              </p>
            </Section>

            <Section title="13. Contact">
              <p>
                Questions about these Terms, or reports of abuse, can be sent
                to{" "}
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
