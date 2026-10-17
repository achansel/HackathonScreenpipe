// Escalade : une demande anonyme restée sans réponse devient l'aide « 💬 Slack + message » de Minguk.
// On réutilise SON modèle de notification (minguk/src/notify/templates.ts), importé tel quel, sans le
// modifier : le bon canal de PipingTable selon l'étape, un message prêt à coller, [Copier] puis [Ouvrir].
import { buildPayload, lintPayload } from "../../minguk/src/notify/templates.ts";
import type { Episode, NotifyPayload } from "../../minguk/src/notify/types.ts";

export interface SlackUrls { support: string; bugs: string; dealDesk: string; newLeads: string }

// Canaux du Slack « Piping Company » (minguk/build/pipingtable.md), choisis d'après l'étape.
export function channelFor(step: string, urls: SlackUrls) {
  if (/bug/i.test(step)) return { channel: "#bugs", url: urls.bugs };
  if (/remise|deal|devis/i.test(step)) return { channel: "#deal-desk", url: urls.dealDesk };
  if (/prospect|lead/i.test(step)) return { channel: "#new-leads", url: urls.newLeads };
  return { channel: "#support", url: urls.support };
}

/** La notification d'escalade, au format de Minguk. L'étape ne contient ni nom ni donnée client. */
export function escalationPayload(requestId: string, step: string, urls: SlackUrls): { payload: NotifyPayload; channel: string; problems: string[] } {
  const { channel, url } = channelFor(step, urls);
  const episode: Episode = {
    id: `fa-escalade-${requestId}`,
    stage: step,
    createdAt: Date.now(),
    customerWaiting: true,
    help: {
      kind: "slack",
      channel,
      channelUrl: url,
      reason: "Sans réponse",
      message: `[Question] ${step}\nCe que j'ai essayé : personne dans l'équipe n'avait encore la réponse.`,
    },
  };
  const payload = buildPayload(episode);
  return { payload, channel, problems: lintPayload(payload) };
}
