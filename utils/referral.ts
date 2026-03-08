export interface ReferralSystemSettings {
    enabled: boolean;
    reward_type: 'fixed' | 'percentage';
    reward_value: number;
    duration: 'once' | 'continuous';
    min_order_amount: number;
    is_banner_visible: boolean;
    banner_title: string;
    banner_subtitle: string;
    banner_cta_text: string;
    is_popup_visible: boolean;
    popup_show_once: boolean;
    popup_title: string;
    popup_subtitle: string;
    popup_reward_highlight: string;
    popup_share_button_text: string;
    popup_code_label: string;
    allow_manual_referral_entry: boolean;
    share_link_base: string;
    share_message_template: string;
}

export const PENDING_REFERRAL_CODE_STORAGE_KEY = 'pending_referral_code_v1';
export const REFERRAL_POPUP_SEEN_STORAGE_KEY = 'referral_popup_seen_v1';

export const DEFAULT_REFERRAL_SETTINGS: ReferralSystemSettings = {
    enabled: true,
    reward_type: 'fixed',
    reward_value: 500,
    duration: 'once',
    min_order_amount: 1000,
    is_banner_visible: true,
    banner_title: 'INVITE FRIENDS, WIN CASH!',
    banner_subtitle: 'Refer a friend and earn rewards when they complete their first order.',
    banner_cta_text: 'Invite Friends Now',
    is_popup_visible: true,
    popup_show_once: true,
    popup_title: 'INVITE FRIENDS, WIN CASH!',
    popup_subtitle: 'Refer a friend and GET 500 into your Quible wallet.',
    popup_reward_highlight: 'Refer & Get 500',
    popup_share_button_text: 'Share link',
    popup_code_label: 'Your code',
    allow_manual_referral_entry: true,
    share_link_base: 'https://quible.app/invite',
    share_message_template: 'Join me on Quible. Use my referral code {{code}} and sign up with this link: {{link}}',
};

const asBoolean = (value: unknown, fallback: boolean) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowered = value.toLowerCase();
        if (lowered === 'true') return true;
        if (lowered === 'false') return false;
    }
    return fallback;
};

const asNumber = (value: unknown, fallback: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const asText = (value: unknown, fallback: string) => {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return fallback;
};

export const mergeReferralSettings = (raw: unknown): ReferralSystemSettings => {
    const input = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    return {
        enabled: asBoolean(input.enabled, DEFAULT_REFERRAL_SETTINGS.enabled),
        reward_type: input.reward_type === 'percentage' ? 'percentage' : 'fixed',
        reward_value: asNumber(input.reward_value, DEFAULT_REFERRAL_SETTINGS.reward_value),
        duration: input.duration === 'continuous' ? 'continuous' : 'once',
        min_order_amount: asNumber(input.min_order_amount, DEFAULT_REFERRAL_SETTINGS.min_order_amount),
        is_banner_visible: asBoolean(input.is_banner_visible, DEFAULT_REFERRAL_SETTINGS.is_banner_visible),
        banner_title: asText(input.banner_title, DEFAULT_REFERRAL_SETTINGS.banner_title),
        banner_subtitle: asText(input.banner_subtitle, DEFAULT_REFERRAL_SETTINGS.banner_subtitle),
        banner_cta_text: asText(input.banner_cta_text, DEFAULT_REFERRAL_SETTINGS.banner_cta_text),
        is_popup_visible: asBoolean(input.is_popup_visible, DEFAULT_REFERRAL_SETTINGS.is_popup_visible),
        popup_show_once: asBoolean(input.popup_show_once, DEFAULT_REFERRAL_SETTINGS.popup_show_once),
        popup_title: asText(input.popup_title, DEFAULT_REFERRAL_SETTINGS.popup_title),
        popup_subtitle: asText(input.popup_subtitle, DEFAULT_REFERRAL_SETTINGS.popup_subtitle),
        popup_reward_highlight: asText(input.popup_reward_highlight, DEFAULT_REFERRAL_SETTINGS.popup_reward_highlight),
        popup_share_button_text: asText(input.popup_share_button_text, DEFAULT_REFERRAL_SETTINGS.popup_share_button_text),
        popup_code_label: asText(input.popup_code_label, DEFAULT_REFERRAL_SETTINGS.popup_code_label),
        allow_manual_referral_entry: asBoolean(input.allow_manual_referral_entry, DEFAULT_REFERRAL_SETTINGS.allow_manual_referral_entry),
        share_link_base: asText(input.share_link_base, DEFAULT_REFERRAL_SETTINGS.share_link_base),
        share_message_template: asText(input.share_message_template, DEFAULT_REFERRAL_SETTINGS.share_message_template),
    };
};

export const normalizeReferralCode = (value: string | null | undefined) =>
    (value || '').trim().toUpperCase();

export const buildReferralShareLink = (baseUrl: string, referralCode: string) => {
    const base = (baseUrl || '').trim() || DEFAULT_REFERRAL_SETTINGS.share_link_base;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}ref=${encodeURIComponent(referralCode)}`;
};

export const buildReferralShareMessage = (settings: ReferralSystemSettings, referralCode: string) => {
    const link = buildReferralShareLink(settings.share_link_base, referralCode);
    const deepLink = `quible://signup?ref=${encodeURIComponent(referralCode)}`;
    const template = settings.share_message_template || DEFAULT_REFERRAL_SETTINGS.share_message_template;

    return template
        .replaceAll('{{code}}', referralCode)
        .replaceAll('{{link}}', link)
        .replaceAll('{{deep_link}}', deepLink);
};

export const extractReferralCodeFromAnyUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/[?&#](?:ref|code|referral|referral_code)=([^&#]+)/i);
    return normalizeReferralCode(match?.[1] || '');
};
