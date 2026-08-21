export interface AppUser {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    phone: string;
    role: 'admin'|'instructor'|'customer';
    created_at: Date;
}


export interface AuthToken{
    id: number;
    app_user: number;
    token_hash: string;
    purpose: 'invite'|'password_reset';
    expires_at: Date;
    used_at: Date;
    created_at: Date;
}

export interface MembershipPlan{
    id: number;
    name: string;
    description: string;
    image: string;
    price: number;
    duration_days: number;
    class_credits: number;
    created_at: Date;
}

export interface CustomerMembership{
    id: number;
    app_user: number;
    plan_id: number;
    start_date: Date;
    end_date: Date;
    status: 'active'|'expired'|'cancelled';
    credits_remaining: number;
    created_at: Date;
}

export interface ClassType{
    id: number;
    name: string;
    description: string;
    image: string;
    credit: boolean;
    active: boolean;
    created_at: Date;
}

export interface Class{
    id: number;
    class_type_id: number;
    status: 'active'|'cancelled'|'expired';
    start_time: Date;
    end_time: Date;
    class_date: Date;
    capacity: number;
    created_at: Date;
}

export interface Enrollment{
    id: number;
    class_id: number;
    app_user: number;
    status: 'enrolled'|'unenrolled'|'cancelled';
    enrolled_at: Date;
    unenrolled_at: Date;
    cancelled_by_admin: boolean;
    created_at: Date;
}

export interface Notification{
    id: number;
    body: string;
    created_at: Date;
}

export interface NotificationLog{
    id: number;
    app_user: number;
    notification_id: number;
    status: 'pending'|'sent'|'failed';
    error_message: string;
    sent_at: Date;
    read_at: Date;
    created_at: Date;
}

export interface PushNotification{
    id: number;
    app_user: number;
    endpoint: string;
    public_key: string;
    auth_secret: string;
    created_at: Date;
}

export type FreshUser = Omit<AppUser, 'password_hash'|'created_at'>;
export type AuthokenInvite = Pick<AuthToken, 'token_hash'|'app_user'>;