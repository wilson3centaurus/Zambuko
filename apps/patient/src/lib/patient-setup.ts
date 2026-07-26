export type PatientSetupData = {
  profile: {
    full_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    city?: string | null;
    province?: string | null;
  } | null;
  patient: {
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    emergency_contact_relation?: string | null;
    legal_full_name?: string | null;
    national_id?: string | null;
    national_id_document_path?: string | null;
    consent_given_at?: string | null;
  } | null;
};

export const REQUIRED_SETUP_FIELDS = [
  { label: "Profile photo", isMissing: (data: PatientSetupData) => !data.profile?.avatar_url },
  { label: "Full name", isMissing: (data: PatientSetupData) => !data.profile?.full_name?.trim() },
  { label: "Phone number", isMissing: (data: PatientSetupData) => !data.profile?.phone?.trim() },
  { label: "Date of birth", isMissing: (data: PatientSetupData) => !data.profile?.date_of_birth },
  { label: "Gender", isMissing: (data: PatientSetupData) => !data.profile?.gender },
  { label: "City", isMissing: (data: PatientSetupData) => !data.profile?.city?.trim() },
  { label: "Province", isMissing: (data: PatientSetupData) => !data.profile?.province?.trim() },
  { label: "Emergency contact name", isMissing: (data: PatientSetupData) => !data.patient?.emergency_contact_name?.trim() },
  { label: "Emergency contact phone", isMissing: (data: PatientSetupData) => !data.patient?.emergency_contact_phone?.trim() },
  { label: "Emergency contact relationship", isMissing: (data: PatientSetupData) => !data.patient?.emergency_contact_relation?.trim() },
  { label: "Full legal name", isMissing: (data: PatientSetupData) => !data.patient?.legal_full_name?.trim() },
  { label: "National ID number", isMissing: (data: PatientSetupData) => !data.patient?.national_id?.trim() },
  { label: "National ID image", isMissing: (data: PatientSetupData) => !data.patient?.national_id_document_path },
  { label: "Health-data consent", isMissing: (data: PatientSetupData) => !data.patient?.consent_given_at },
] as const;

export function getMissingSetupFields(data: PatientSetupData | null | undefined) {
  if (!data) return [];
  return REQUIRED_SETUP_FIELDS.filter((field) => field.isMissing(data)).map((field) => field.label);
}
