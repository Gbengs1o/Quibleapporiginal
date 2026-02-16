-- Chats System
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.delivery_requests(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL, -- The Customer
    rider_id UUID REFERENCES auth.users(id) NOT NULL, -- The Rider
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(request_id, user_id, rider_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Chats Policies
CREATE POLICY "Users/Riders can view their chats" ON public.chats
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = rider_id);

CREATE POLICY "System can create chats" ON public.chats
    FOR INSERT WITH CHECK (true); -- Usually triggered by app logic

-- Messages Policies
CREATE POLICY "Participants can view messages" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.user_id = auth.uid() OR chats.rider_id = auth.uid())
        )
    );

CREATE POLICY "Participants can insert messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = chat_id 
            AND (chats.user_id = auth.uid() OR chats.rider_id = auth.uid())
        )
    );

-- Function to get or create chat
CREATE OR REPLACE FUNCTION get_or_create_chat(
    p_request_id UUID,
    p_user_id UUID,
    p_rider_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_chat_id UUID;
BEGIN
    SELECT id INTO v_chat_id
    FROM public.chats
    WHERE request_id = p_request_id AND user_id = p_user_id AND rider_id = p_rider_id;

    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    INSERT INTO public.chats (request_id, user_id, rider_id)
    VALUES (p_request_id, p_user_id, p_rider_id)
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$;
