export declare class AddParticipantDto {
    conferenceName: string;
    targetNumber: string;
    fromNumber?: string;
}
export declare class ForwardCallDto {
    conferenceName: string;
    targetNumber: string;
    dropAgentLeg?: boolean;
    fromNumber?: string;
}
export declare class EndConferenceDto {
    conferenceName: string;
}
