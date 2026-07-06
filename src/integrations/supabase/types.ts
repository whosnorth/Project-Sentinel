export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_reviews: {
        Row: {
          analysis_json: Json
          created_at: string | null
          id: string
          model_version: string | null
          report_id: string | null
          status: string | null
        }
        Insert: {
          analysis_json: Json
          created_at?: string | null
          id?: string
          model_version?: string | null
          report_id?: string | null
          status?: string | null
        }
        Update: {
          analysis_json?: Json
          created_at?: string | null
          id?: string
          model_version?: string | null
          report_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_reviews_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      api_access_logs: {
        Row: {
          api_key_id: string | null
          company_queried: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          response_code: string | null
          status: string | null
          timestamp: string | null
          trace_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          company_queried?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          response_code?: string | null
          status?: string | null
          timestamp?: string | null
          trace_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          company_queried?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          response_code?: string | null
          status?: string | null
          timestamp?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_access_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          scopes: string[] | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          scopes?: string[] | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          scopes?: string[] | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_profiles_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_velocity_logs: {
        Row: {
          endpoint: string
          timestamp: string
          user_id: string
        }
        Insert: {
          endpoint: string
          timestamp?: string
          user_id: string
        }
        Update: {
          endpoint?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      approval_comments: {
        Row: {
          action: string
          comment: string | null
          created_at: string | null
          id: string
          report_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          comment?: string | null
          created_at?: string | null
          id?: string
          report_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          report_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_activities: {
        Row: {
          activity_category: string
          completed_date: string | null
          created_at: string
          description: string | null
          id: string
          scheduled_date: string | null
          status: string
          status_type: string
          title: string
        }
        Insert: {
          activity_category: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          scheduled_date?: string | null
          status: string
          status_type: string
          title: string
        }
        Update: {
          activity_category?: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          scheduled_date?: string | null
          status?: string
          status_type?: string
          title?: string
        }
        Relationships: []
      }
      carbon_calculations: {
        Row: {
          carbon_offsets_tco2e: number | null
          commute_km: number | null
          created_at: string | null
          diesel_liters: number | null
          flight_hours: number | null
          grid_kwh: number | null
          id: string
          net_zero_target_year: number | null
          petrol_liters: number | null
          renewable_energy_pct: number | null
          report_id: string
          scope3_total_tco2e: number | null
          total_tco2e: number | null
          waste_kg: number | null
          waste_recycled_pct: number | null
          waste_total_tonnes: number | null
          water_consumption_m3: number | null
          water_withdrawal_m3: number | null
        }
        Insert: {
          carbon_offsets_tco2e?: number | null
          commute_km?: number | null
          created_at?: string | null
          diesel_liters?: number | null
          flight_hours?: number | null
          grid_kwh?: number | null
          id?: string
          net_zero_target_year?: number | null
          petrol_liters?: number | null
          renewable_energy_pct?: number | null
          report_id: string
          scope3_total_tco2e?: number | null
          total_tco2e?: number | null
          waste_kg?: number | null
          waste_recycled_pct?: number | null
          waste_total_tonnes?: number | null
          water_consumption_m3?: number | null
          water_withdrawal_m3?: number | null
        }
        Update: {
          carbon_offsets_tco2e?: number | null
          commute_km?: number | null
          created_at?: string | null
          diesel_liters?: number | null
          flight_hours?: number | null
          grid_kwh?: number | null
          id?: string
          net_zero_target_year?: number | null
          petrol_liters?: number | null
          renewable_energy_pct?: number | null
          report_id?: string
          scope3_total_tco2e?: number | null
          total_tco2e?: number | null
          waste_kg?: number | null
          waste_recycled_pct?: number | null
          waste_total_tonnes?: number | null
          water_consumption_m3?: number | null
          water_withdrawal_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "carbon_calculations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      cas_calibration_log: {
        Row: {
          applied_at: string | null
          applied_to_live: boolean
          calibrated_env_weight: number
          calibrated_op_weight: number
          calibrated_patient_weight: number
          confidence_score: number
          created_at: string
          created_by: string | null
          delta_env_weight: number
          delta_op_weight: number
          delta_patient_weight: number
          epochs_to_converge: number
          id: string
          training_loss: number
          training_samples: number
        }
        Insert: {
          applied_at?: string | null
          applied_to_live?: boolean
          calibrated_env_weight: number
          calibrated_op_weight: number
          calibrated_patient_weight: number
          confidence_score: number
          created_at?: string
          created_by?: string | null
          delta_env_weight?: number
          delta_op_weight?: number
          delta_patient_weight?: number
          epochs_to_converge: number
          id?: string
          training_loss: number
          training_samples: number
        }
        Update: {
          applied_at?: string | null
          applied_to_live?: boolean
          calibrated_env_weight?: number
          calibrated_op_weight?: number
          calibrated_patient_weight?: number
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          delta_env_weight?: number
          delta_op_weight?: number
          delta_patient_weight?: number
          epochs_to_converge?: number
          id?: string
          training_loss?: number
          training_samples?: number
        }
        Relationships: []
      }
      cas_historical_outbreaks: {
        Row: {
          actual_severity: number
          created_at: string | null
          id: string
          intervention_efficacy: number
          population_density: number
          predicted_severity: number | null
          survey_id: string | null
          transmission_rate: number
          used_for_training: boolean | null
        }
        Insert: {
          actual_severity: number
          created_at?: string | null
          id?: string
          intervention_efficacy: number
          population_density: number
          predicted_severity?: number | null
          survey_id?: string | null
          transmission_rate: number
          used_for_training?: boolean | null
        }
        Update: {
          actual_severity?: number
          created_at?: string | null
          id?: string
          intervention_efficacy?: number
          population_density?: number
          predicted_severity?: number | null
          survey_id?: string | null
          transmission_rate?: number
          used_for_training?: boolean | null
        }
        Relationships: []
      }
      cas_model_weights: {
        Row: {
          calibrated_at: string | null
          id: string
          is_active: boolean | null
          learning_rate: number
          mse_score: number | null
          version: number
          w_e: number
          w_o: number
          w_p: number
        }
        Insert: {
          calibrated_at?: string | null
          id?: string
          is_active?: boolean | null
          learning_rate?: number
          mse_score?: number | null
          version?: never
          w_e?: number
          w_o?: number
          w_p?: number
        }
        Update: {
          calibrated_at?: string | null
          id?: string
          is_active?: boolean | null
          learning_rate?: number
          mse_score?: number | null
          version?: never
          w_e?: number
          w_o?: number
          w_p?: number
        }
        Relationships: []
      }
      chain_node_ledgers: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          parent_hash: string | null
          payload: Json | null
          sector: string
          sequence_number: number
          transaction_hash: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          parent_hash?: string | null
          payload?: Json | null
          sector: string
          sequence_number?: number
          transaction_hash: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          parent_hash?: string | null
          payload?: Json | null
          sector?: string
          sequence_number?: number
          transaction_hash?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_logo_url: string | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          dpo_email: string | null
          dpo_name: string | null
          id: string
          industry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_logo_url?: string | null
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          dpo_email?: string | null
          dpo_name?: string | null
          id?: string
          industry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_logo_url?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          dpo_email?: string | null
          dpo_name?: string | null
          id?: string
          industry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      compliance_deadlines: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          created_by: string | null
          deadline_date: string
          description: string | null
          framework: string | null
          id: string
          is_global: boolean | null
          is_system_admin_created: boolean | null
          organization_id: string | null
          priority: string | null
          recurrence: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline_date: string
          description?: string | null
          framework?: string | null
          id?: string
          is_global?: boolean | null
          is_system_admin_created?: boolean | null
          organization_id?: string | null
          priority?: string | null
          recurrence?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline_date?: string
          description?: string | null
          framework?: string | null
          id?: string
          is_global?: boolean | null
          is_system_admin_created?: boolean | null
          organization_id?: string | null
          priority?: string | null
          recurrence?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_deadlines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      concord_contracts: {
        Row: {
          contract_type: string | null
          counterparty: string
          created_at: string
          currency: string | null
          entity_id: string | null
          expires_at: string | null
          id: string
          signature_hash: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          terms_summary: string | null
          title: string
          value_amount: number | null
        }
        Insert: {
          contract_type?: string | null
          counterparty: string
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          expires_at?: string | null
          id?: string
          signature_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          terms_summary?: string | null
          title: string
          value_amount?: number | null
        }
        Update: {
          contract_type?: string | null
          counterparty?: string
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          expires_at?: string | null
          id?: string
          signature_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          terms_summary?: string | null
          title?: string
          value_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "concord_contracts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "concord_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      concord_entities: {
        Row: {
          business_name: string
          contact_email: string | null
          created_at: string
          created_by: string | null
          currency_exposure: string | null
          id: string
          metadata: Json | null
          physical_address: string | null
          registration_number: string | null
          sector: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          business_name: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          currency_exposure?: string | null
          id?: string
          metadata?: Json | null
          physical_address?: string | null
          registration_number?: string | null
          sector?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          currency_exposure?: string | null
          id?: string
          metadata?: Json | null
          physical_address?: string | null
          registration_number?: string | null
          sector?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      concord_payment_logs: {
        Row: {
          amount: number | null
          currency: string | null
          description: string | null
          id: string
          latency_ms: number | null
          response_code: string | null
          settlement_id: string | null
          timestamp: string
        }
        Insert: {
          amount?: number | null
          currency?: string | null
          description?: string | null
          id?: string
          latency_ms?: number | null
          response_code?: string | null
          settlement_id?: string | null
          timestamp?: string
        }
        Update: {
          amount?: number | null
          currency?: string | null
          description?: string | null
          id?: string
          latency_ms?: number | null
          response_code?: string | null
          settlement_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "concord_payment_logs_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "concord_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      concord_settlements: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string
          currency: string | null
          entity_id: string | null
          evidence_notes: string | null
          id: string
          is_simulated: boolean | null
          payment_date: string | null
          payment_reference: string | null
          status: string | null
          submitted_by: string | null
          transaction_hash: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          evidence_notes?: string | null
          id?: string
          is_simulated?: boolean | null
          payment_date?: string | null
          payment_reference?: string | null
          status?: string | null
          submitted_by?: string | null
          transaction_hash?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          evidence_notes?: string | null
          id?: string
          is_simulated?: boolean | null
          payment_date?: string | null
          payment_reference?: string | null
          status?: string | null
          submitted_by?: string | null
          transaction_hash?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concord_settlements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "concord_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concord_settlements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "concord_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      concord_training_programs: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_hours: number | null
          id: string
          is_mandatory: boolean | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_mandatory?: boolean | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_mandatory?: boolean | null
          title?: string
        }
        Relationships: []
      }
      concord_training_records: {
        Row: {
          certificate_hash: string | null
          completion_date: string | null
          created_at: string
          entity_id: string | null
          evidence_notes: string | null
          id: string
          program_id: string | null
          status: string | null
          trainee_name: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          certificate_hash?: string | null
          completion_date?: string | null
          created_at?: string
          entity_id?: string | null
          evidence_notes?: string | null
          id?: string
          program_id?: string | null
          status?: string | null
          trainee_name: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          certificate_hash?: string | null
          completion_date?: string | null
          created_at?: string
          entity_id?: string | null
          evidence_notes?: string | null
          id?: string
          program_id?: string | null
          status?: string | null
          trainee_name?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concord_training_records_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "concord_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concord_training_records_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "concord_training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      concord_verification_queue: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_label: string
          item_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_label: string
          item_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_label?: string
          item_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string | null
        }
        Relationships: []
      }
      country_metadata: {
        Row: {
          country_name: string
          fred_cpi: number | null
          fred_currency_volatility: number | null
          fred_fx_series_id: string | null
          fred_interest_rate: number | null
          imf_current_account_balance: number | null
          imf_gdp_growth: number | null
          imf_gov_gross_debt: number | null
          imf_inflation_rate: number | null
          iso2_code: string
          last_updated: string
          wb_cpia_score: number | null
          wb_lpi_score: number | null
        }
        Insert: {
          country_name: string
          fred_cpi?: number | null
          fred_currency_volatility?: number | null
          fred_fx_series_id?: string | null
          fred_interest_rate?: number | null
          imf_current_account_balance?: number | null
          imf_gdp_growth?: number | null
          imf_gov_gross_debt?: number | null
          imf_inflation_rate?: number | null
          iso2_code: string
          last_updated?: string
          wb_cpia_score?: number | null
          wb_lpi_score?: number | null
        }
        Update: {
          country_name?: string
          fred_cpi?: number | null
          fred_currency_volatility?: number | null
          fred_fx_series_id?: string | null
          fred_interest_rate?: number | null
          imf_current_account_balance?: number | null
          imf_gdp_growth?: number | null
          imf_gov_gross_debt?: number | null
          imf_inflation_rate?: number | null
          iso2_code?: string
          last_updated?: string
          wb_cpia_score?: number | null
          wb_lpi_score?: number | null
        }
        Relationships: []
      }
      dataset_notes: {
        Row: {
          content: string
          dataset_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          dataset_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          dataset_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_notes_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "user_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      epicenter_cases: {
        Row: {
          cas_risk_score: number | null
          case_classification: string | null
          case_count: number | null
          case_origin: string | null
          case_ref: string
          classifying_user_id: string | null
          community: string | null
          created_at: string
          date_of_classification: string | null
          date_of_investigation: string | null
          date_of_outcome: string | null
          date_of_report: string | null
          disease: string
          disease_variant: string | null
          district: string | null
          epid_number: string | null
          external_token: string | null
          facility: string | null
          id: string
          internal_token: string | null
          investigation_status: string | null
          lat: number | null
          lng: number | null
          organization_id: string | null
          outbreak_cluster_id: string | null
          outcome: string | null
          person_id: string | null
          point_of_entry: string | null
          region: string | null
          reporting_user_id: string | null
          sequelae: string | null
          sequelae_description: string | null
          updated_at: string
        }
        Insert: {
          cas_risk_score?: number | null
          case_classification?: string | null
          case_count?: number | null
          case_origin?: string | null
          case_ref?: string
          classifying_user_id?: string | null
          community?: string | null
          created_at?: string
          date_of_classification?: string | null
          date_of_investigation?: string | null
          date_of_outcome?: string | null
          date_of_report?: string | null
          disease: string
          disease_variant?: string | null
          district?: string | null
          epid_number?: string | null
          external_token?: string | null
          facility?: string | null
          id?: string
          internal_token?: string | null
          investigation_status?: string | null
          lat?: number | null
          lng?: number | null
          organization_id?: string | null
          outbreak_cluster_id?: string | null
          outcome?: string | null
          person_id?: string | null
          point_of_entry?: string | null
          region?: string | null
          reporting_user_id?: string | null
          sequelae?: string | null
          sequelae_description?: string | null
          updated_at?: string
        }
        Update: {
          cas_risk_score?: number | null
          case_classification?: string | null
          case_count?: number | null
          case_origin?: string | null
          case_ref?: string
          classifying_user_id?: string | null
          community?: string | null
          created_at?: string
          date_of_classification?: string | null
          date_of_investigation?: string | null
          date_of_outcome?: string | null
          date_of_report?: string | null
          disease?: string
          disease_variant?: string | null
          district?: string | null
          epid_number?: string | null
          external_token?: string | null
          facility?: string | null
          id?: string
          internal_token?: string | null
          investigation_status?: string | null
          lat?: number | null
          lng?: number | null
          organization_id?: string | null
          outbreak_cluster_id?: string | null
          outcome?: string | null
          person_id?: string | null
          point_of_entry?: string | null
          region?: string | null
          reporting_user_id?: string | null
          sequelae?: string | null
          sequelae_description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epicenter_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epicenter_contacts: {
        Row: {
          contact_classification: string | null
          contact_person_id: string | null
          contact_ref: string
          contact_status: string | null
          converted_to_case_id: string | null
          created_at: string
          disease: string
          follow_up_end: string | null
          follow_up_start: string | null
          follow_up_status: string | null
          id: string
          missed_visits: number | null
          number_of_visits: number | null
          organization_id: string | null
          source_case_id: string | null
          type_of_contact: string | null
          updated_at: string
          vaccination_status: string | null
        }
        Insert: {
          contact_classification?: string | null
          contact_person_id?: string | null
          contact_ref?: string
          contact_status?: string | null
          converted_to_case_id?: string | null
          created_at?: string
          disease: string
          follow_up_end?: string | null
          follow_up_start?: string | null
          follow_up_status?: string | null
          id?: string
          missed_visits?: number | null
          number_of_visits?: number | null
          organization_id?: string | null
          source_case_id?: string | null
          type_of_contact?: string | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Update: {
          contact_classification?: string | null
          contact_person_id?: string | null
          contact_ref?: string
          contact_status?: string | null
          converted_to_case_id?: string | null
          created_at?: string
          disease?: string
          follow_up_end?: string | null
          follow_up_start?: string | null
          follow_up_status?: string | null
          id?: string
          missed_visits?: number | null
          number_of_visits?: number | null
          organization_id?: string | null
          source_case_id?: string | null
          type_of_contact?: string | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epicenter_contacts_converted_to_case_id_fkey"
            columns: ["converted_to_case_id"]
            isOneToOne: false
            referencedRelation: "epicenter_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epicenter_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epicenter_contacts_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "epicenter_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      epicenter_environmental_alerts: {
        Row: {
          current_usage: number
          gps_coordinates: Json | null
          id: string
          region: string
          resource_type: string
          status: string | null
          threshold_limit: number
          updated_at: string
        }
        Insert: {
          current_usage: number
          gps_coordinates?: Json | null
          id?: string
          region: string
          resource_type: string
          status?: string | null
          threshold_limit: number
          updated_at?: string
        }
        Update: {
          current_usage?: number
          gps_coordinates?: Json | null
          id?: string
          region?: string
          resource_type?: string
          status?: string | null
          threshold_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      epicenter_governance_queue: {
        Row: {
          action_type: string
          approved_at: string | null
          approver_id: string | null
          created_at: string
          effectiveness_score: number | null
          env_alert_count_at_onset: number | null
          id: string
          op_flag_count_at_onset: number | null
          patient_count_at_onset: number | null
          payload: Json
          requester_id: string | null
          resolution_report: Json | null
          resolution_status: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          effectiveness_score?: number | null
          env_alert_count_at_onset?: number | null
          id?: string
          op_flag_count_at_onset?: number | null
          patient_count_at_onset?: number | null
          payload: Json
          requester_id?: string | null
          resolution_report?: Json | null
          resolution_status?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          effectiveness_score?: number | null
          env_alert_count_at_onset?: number | null
          id?: string
          op_flag_count_at_onset?: number | null
          patient_count_at_onset?: number | null
          payload?: Json
          requester_id?: string | null
          resolution_report?: Json | null
          resolution_status?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      epicenter_immunizations: {
        Row: {
          created_at: string
          date_of_recovery: string | null
          disease: string
          end_date: string | null
          id: string
          immunization_status: string | null
          management_status: string | null
          means_of_immunization: string | null
          organization_id: string | null
          person_id: string | null
          start_date: string | null
          updated_at: string
          vaccine_type: string | null
        }
        Insert: {
          created_at?: string
          date_of_recovery?: string | null
          disease: string
          end_date?: string | null
          id?: string
          immunization_status?: string | null
          management_status?: string | null
          means_of_immunization?: string | null
          organization_id?: string | null
          person_id?: string | null
          start_date?: string | null
          updated_at?: string
          vaccine_type?: string | null
        }
        Update: {
          created_at?: string
          date_of_recovery?: string | null
          disease?: string
          end_date?: string | null
          id?: string
          immunization_status?: string | null
          management_status?: string | null
          means_of_immunization?: string | null
          organization_id?: string | null
          person_id?: string | null
          start_date?: string | null
          updated_at?: string
          vaccine_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epicenter_immunizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      epicenter_logistics_fleet: {
        Row: {
          current_location: Json
          customs_cleared: boolean | null
          id: string
          status: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          current_location: Json
          customs_cleared?: boolean | null
          id?: string
          status?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          current_location?: Json
          customs_cleared?: boolean | null
          id?: string
          status?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      epicenter_patient_registry: {
        Row: {
          age_group: string | null
          agent_id: string | null
          created_at: string
          diagnosis_category: string
          environmental_context: Json | null
          facility_id: string
          gender: string | null
          gps_coordinates: Json | null
          id: string
          patient_hash: string
          prescribed_meds: string[] | null
          risk_level: string | null
          status: string | null
          surveyor_id: string | null
          verified_at: string | null
          verifier_id: string | null
          vitals: Json | null
        }
        Insert: {
          age_group?: string | null
          agent_id?: string | null
          created_at?: string
          diagnosis_category: string
          environmental_context?: Json | null
          facility_id: string
          gender?: string | null
          gps_coordinates?: Json | null
          id?: string
          patient_hash: string
          prescribed_meds?: string[] | null
          risk_level?: string | null
          status?: string | null
          surveyor_id?: string | null
          verified_at?: string | null
          verifier_id?: string | null
          vitals?: Json | null
        }
        Update: {
          age_group?: string | null
          agent_id?: string | null
          created_at?: string
          diagnosis_category?: string
          environmental_context?: Json | null
          facility_id?: string
          gender?: string | null
          gps_coordinates?: Json | null
          id?: string
          patient_hash?: string
          prescribed_meds?: string[] | null
          risk_level?: string | null
          status?: string | null
          surveyor_id?: string | null
          verified_at?: string | null
          verifier_id?: string | null
          vitals?: Json | null
        }
        Relationships: []
      }
      epicenter_pharma_bids: {
        Row: {
          created_at: string
          drug_code: string
          id: string
          max_price_per_unit: number
          quantity_needed: number
          status: string | null
          target_facility: string
        }
        Insert: {
          created_at?: string
          drug_code: string
          id?: string
          max_price_per_unit: number
          quantity_needed: number
          status?: string | null
          target_facility: string
        }
        Update: {
          created_at?: string
          drug_code?: string
          id?: string
          max_price_per_unit?: number
          quantity_needed?: number
          status?: string | null
          target_facility?: string
        }
        Relationships: []
      }
      epicenter_surveys: {
        Row: {
          age_group: string | null
          biometric_hash: string | null
          client_metadata: Json | null
          client_status: string | null
          created_at: string
          epi_week: number | null
          epi_year: number | null
          gender: string | null
          gps_coordinates: Json | null
          health_metrics: Json | null
          id: string
          linked_case_id: string | null
          national_identity_number: string | null
          prescribed_meds: string[] | null
          respondent_name: string | null
          risk_level: string | null
          survey_template_id: string | null
          surveyor_id: string
          updated_at: string
          validation_notes: string | null
          validation_status: string | null
          vitals: Json | null
        }
        Insert: {
          age_group?: string | null
          biometric_hash?: string | null
          client_metadata?: Json | null
          client_status?: string | null
          created_at?: string
          epi_week?: number | null
          epi_year?: number | null
          gender?: string | null
          gps_coordinates?: Json | null
          health_metrics?: Json | null
          id?: string
          linked_case_id?: string | null
          national_identity_number?: string | null
          prescribed_meds?: string[] | null
          respondent_name?: string | null
          risk_level?: string | null
          survey_template_id?: string | null
          surveyor_id: string
          updated_at?: string
          validation_notes?: string | null
          validation_status?: string | null
          vitals?: Json | null
        }
        Update: {
          age_group?: string | null
          biometric_hash?: string | null
          client_metadata?: Json | null
          client_status?: string | null
          created_at?: string
          epi_week?: number | null
          epi_year?: number | null
          gender?: string | null
          gps_coordinates?: Json | null
          health_metrics?: Json | null
          id?: string
          linked_case_id?: string | null
          national_identity_number?: string | null
          prescribed_meds?: string[] | null
          respondent_name?: string | null
          risk_level?: string | null
          survey_template_id?: string | null
          surveyor_id?: string
          updated_at?: string
          validation_notes?: string | null
          validation_status?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meridian_surveys_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "meridian_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_surveys_survey_template_id_fkey"
            columns: ["survey_template_id"]
            isOneToOne: false
            referencedRelation: "meridian_survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      epicenter_system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      epicenter_trade_sme: {
        Row: {
          business_name: string
          created_at: string
          credential_status: string | null
          currency_exposure: string
          id: string
          registration_number: string
        }
        Insert: {
          business_name: string
          created_at?: string
          credential_status?: string | null
          currency_exposure: string
          id?: string
          registration_number: string
        }
        Update: {
          business_name?: string
          created_at?: string
          credential_status?: string | null
          currency_exposure?: string
          id?: string
          registration_number?: string
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          esg_category: Database["public"]["Enums"]["esg_category"]
          file_hash: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          linked_field: string | null
          report_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          transaction_date: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          esg_category: Database["public"]["Enums"]["esg_category"]
          file_hash?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          linked_field?: string | null
          report_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          transaction_date?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          esg_category?: Database["public"]["Enums"]["esg_category"]
          file_hash?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          linked_field?: string | null
          report_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          transaction_date?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_metrics: {
        Row: {
          audit_firm: string | null
          audit_opinion: string | null
          auditor_fees: number | null
          capex: number | null
          created_at: string | null
          current_ratio: number | null
          debt_to_equity: number | null
          earnings_per_share: number | null
          ebitda: number | null
          equity: number | null
          framework: string
          gross_revenue: number | null
          has_going_concern: boolean | null
          has_restatements: boolean | null
          id: string
          interest_expense: number | null
          material_weaknesses_count: number | null
          net_profit: number | null
          operating_cash_flow: number | null
          operating_expenses: number | null
          operating_profit: number | null
          prior_year_net_profit: number | null
          prior_year_revenue: number | null
          report_id: string
          reporting_currency: string | null
          return_on_equity: number | null
          revenue: number | null
          tax_expense: number | null
          total_assets: number | null
          total_liabilities: number | null
          updated_at: string | null
        }
        Insert: {
          audit_firm?: string | null
          audit_opinion?: string | null
          auditor_fees?: number | null
          capex?: number | null
          created_at?: string | null
          current_ratio?: number | null
          debt_to_equity?: number | null
          earnings_per_share?: number | null
          ebitda?: number | null
          equity?: number | null
          framework?: string
          gross_revenue?: number | null
          has_going_concern?: boolean | null
          has_restatements?: boolean | null
          id?: string
          interest_expense?: number | null
          material_weaknesses_count?: number | null
          net_profit?: number | null
          operating_cash_flow?: number | null
          operating_expenses?: number | null
          operating_profit?: number | null
          prior_year_net_profit?: number | null
          prior_year_revenue?: number | null
          report_id: string
          reporting_currency?: string | null
          return_on_equity?: number | null
          revenue?: number | null
          tax_expense?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          updated_at?: string | null
        }
        Update: {
          audit_firm?: string | null
          audit_opinion?: string | null
          auditor_fees?: number | null
          capex?: number | null
          created_at?: string | null
          current_ratio?: number | null
          debt_to_equity?: number | null
          earnings_per_share?: number | null
          ebitda?: number | null
          equity?: number | null
          framework?: string
          gross_revenue?: number | null
          has_going_concern?: boolean | null
          has_restatements?: boolean | null
          id?: string
          interest_expense?: number | null
          material_weaknesses_count?: number | null
          net_profit?: number | null
          operating_cash_flow?: number | null
          operating_expenses?: number | null
          operating_profit?: number | null
          prior_year_net_profit?: number | null
          prior_year_revenue?: number | null
          report_id?: string
          reporting_currency?: string | null
          return_on_equity?: number | null
          revenue?: number | null
          tax_expense?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_metrics_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      global_sanctions_list: {
        Row: {
          aliases: string[] | null
          external_id: string
          id: string
          last_updated_at: string | null
          name: string
          nationality: string | null
          program: string | null
          source_url: string | null
        }
        Insert: {
          aliases?: string[] | null
          external_id: string
          id?: string
          last_updated_at?: string | null
          name: string
          nationality?: string | null
          program?: string | null
          source_url?: string | null
        }
        Update: {
          aliases?: string[] | null
          external_id?: string
          id?: string
          last_updated_at?: string | null
          name?: string
          nationality?: string | null
          program?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      governance_metrics: {
        Row: {
          auditor_rotation_years: number | null
          average_board_attendance_rate: number | null
          average_director_tenure: number | null
          board_evaluation_frequency: string | null
          board_meetings_held: number | null
          board_size: number | null
          ceo_is_chair: boolean | null
          created_at: string | null
          created_by: string | null
          cyber_security_incidents: number | null
          data_breaches_count: number | null
          ethics_training_completion_rate: number | null
          executive_remuneration_disclosed: boolean | null
          female_directors: number | null
          gdpr_compliant: boolean | null
          has_aml_kyc_policy: boolean | null
          has_anti_bribery_policy: boolean | null
          has_anti_corruption_policy: boolean | null
          has_audit_committee: boolean | null
          has_code_of_conduct: boolean | null
          has_data_privacy_policy: boolean | null
          has_esg_committee: boolean | null
          has_internal_audit: boolean | null
          has_nomination_committee: boolean | null
          has_related_party_transactions: boolean | null
          has_remuneration_committee: boolean | null
          has_risk_committee: boolean | null
          has_risk_management_framework: boolean | null
          has_succession_plan: boolean | null
          has_whistleblower_policy: boolean | null
          id: string
          independent_directors: number | null
          legal_actions_count: number | null
          regulatory_fines_amount: number | null
          related_party_transactions_amount: number | null
          report_id: string
          shareholder_meetings_held: number | null
          shareholder_proposals_received: number | null
          updated_at: string | null
        }
        Insert: {
          auditor_rotation_years?: number | null
          average_board_attendance_rate?: number | null
          average_director_tenure?: number | null
          board_evaluation_frequency?: string | null
          board_meetings_held?: number | null
          board_size?: number | null
          ceo_is_chair?: boolean | null
          created_at?: string | null
          created_by?: string | null
          cyber_security_incidents?: number | null
          data_breaches_count?: number | null
          ethics_training_completion_rate?: number | null
          executive_remuneration_disclosed?: boolean | null
          female_directors?: number | null
          gdpr_compliant?: boolean | null
          has_aml_kyc_policy?: boolean | null
          has_anti_bribery_policy?: boolean | null
          has_anti_corruption_policy?: boolean | null
          has_audit_committee?: boolean | null
          has_code_of_conduct?: boolean | null
          has_data_privacy_policy?: boolean | null
          has_esg_committee?: boolean | null
          has_internal_audit?: boolean | null
          has_nomination_committee?: boolean | null
          has_related_party_transactions?: boolean | null
          has_remuneration_committee?: boolean | null
          has_risk_committee?: boolean | null
          has_risk_management_framework?: boolean | null
          has_succession_plan?: boolean | null
          has_whistleblower_policy?: boolean | null
          id?: string
          independent_directors?: number | null
          legal_actions_count?: number | null
          regulatory_fines_amount?: number | null
          related_party_transactions_amount?: number | null
          report_id: string
          shareholder_meetings_held?: number | null
          shareholder_proposals_received?: number | null
          updated_at?: string | null
        }
        Update: {
          auditor_rotation_years?: number | null
          average_board_attendance_rate?: number | null
          average_director_tenure?: number | null
          board_evaluation_frequency?: string | null
          board_meetings_held?: number | null
          board_size?: number | null
          ceo_is_chair?: boolean | null
          created_at?: string | null
          created_by?: string | null
          cyber_security_incidents?: number | null
          data_breaches_count?: number | null
          ethics_training_completion_rate?: number | null
          executive_remuneration_disclosed?: boolean | null
          female_directors?: number | null
          gdpr_compliant?: boolean | null
          has_aml_kyc_policy?: boolean | null
          has_anti_bribery_policy?: boolean | null
          has_anti_corruption_policy?: boolean | null
          has_audit_committee?: boolean | null
          has_code_of_conduct?: boolean | null
          has_data_privacy_policy?: boolean | null
          has_esg_committee?: boolean | null
          has_internal_audit?: boolean | null
          has_nomination_committee?: boolean | null
          has_related_party_transactions?: boolean | null
          has_remuneration_committee?: boolean | null
          has_risk_committee?: boolean | null
          has_risk_management_framework?: boolean | null
          has_succession_plan?: boolean | null
          has_whistleblower_policy?: boolean | null
          id?: string
          independent_directors?: number | null
          legal_actions_count?: number | null
          regulatory_fines_amount?: number | null
          related_party_transactions_amount?: number | null
          report_id?: string
          shareholder_meetings_held?: number | null
          shareholder_proposals_received?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_metrics_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      hmo_clinic_links: {
        Row: {
          clinic_org_id: string
          created_at: string
          created_by: string | null
          hmo_org_id: string
          id: string
        }
        Insert: {
          clinic_org_id: string
          created_at?: string
          created_by?: string | null
          hmo_org_id: string
          id?: string
        }
        Update: {
          clinic_org_id?: string
          created_at?: string
          created_by?: string | null
          hmo_org_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hmo_clinic_links_clinic_org_id_fkey"
            columns: ["clinic_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hmo_clinic_links_hmo_org_id_fkey"
            columns: ["hmo_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_billing_ledger: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          patient_id: string
          payment_method: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          patient_id: string
          payment_method?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          payment_method?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_billing_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_billing_ledger_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_billing_ledger_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_dispense_log: {
        Row: {
          created_at: string | null
          dispensed_by: string | null
          id: string
          item_id: string
          item_name: string
          organization_id: string
          qty_dispensed: number
        }
        Insert: {
          created_at?: string | null
          dispensed_by?: string | null
          id?: string
          item_id: string
          item_name: string
          organization_id: string
          qty_dispensed: number
        }
        Update: {
          created_at?: string | null
          dispensed_by?: string | null
          id?: string
          item_id?: string
          item_name?: string
          organization_id?: string
          qty_dispensed?: number
        }
        Relationships: [
          {
            foreignKeyName: "hospital_dispense_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "hospital_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_dispense_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_inventory: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          qty: number
          threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          qty?: number
          threshold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          qty?: number
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_inventory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_patients_secure: {
        Row: {
          archived_at: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: string | null
          hmo_consent_given: boolean | null
          hmo_enrollee_id: string | null
          hmo_provider_id: string | null
          id: string
          is_estimated_dob: boolean | null
          last_name: string | null
          organization_id: string | null
          outstanding_balance: number | null
          phone_number: string | null
          phone_number_hash: string | null
          qr_code_hash: string | null
          searchable_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          hmo_consent_given?: boolean | null
          hmo_enrollee_id?: string | null
          hmo_provider_id?: string | null
          id?: string
          is_estimated_dob?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          outstanding_balance?: number | null
          phone_number?: string | null
          phone_number_hash?: string | null
          qr_code_hash?: string | null
          searchable_id?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          hmo_consent_given?: boolean | null
          hmo_enrollee_id?: string | null
          hmo_provider_id?: string | null
          id?: string
          is_estimated_dob?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          outstanding_balance?: number | null
          phone_number?: string | null
          phone_number_hash?: string | null
          qr_code_hash?: string | null
          searchable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_patients_secure_hmo_provider_id_fkey"
            columns: ["hmo_provider_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_records: {
        Row: {
          anonymized_epicenter_case_id: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string | null
          patient_id: string | null
          record_data: Json
          template_id: string | null
          updated_at: string
        }
        Insert: {
          anonymized_epicenter_case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          patient_id?: string | null
          record_data?: Json
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          anonymized_epicenter_case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          patient_id?: string | null
          record_data?: Json
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hospital_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_room_assignments: {
        Row: {
          admitted_at: string
          created_by: string | null
          id: string
          organization_id: string
          patient_id: string
          room_number: number
        }
        Insert: {
          admitted_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          patient_id: string
          room_number: number
        }
        Update: {
          admitted_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          room_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "hospital_room_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_room_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_room_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_settings: {
        Row: {
          created_at: string
          organization_id: string
          total_rooms: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          total_rooms?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          total_rooms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          form_schema: Json
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          form_schema?: Json
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          form_schema?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_waiting_queue: {
        Row: {
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          organization_id: string
          patient_hash: string
          patient_id: string | null
          status: string
          time_added: string | null
        }
        Insert: {
          created_at?: string | null
          first_name: string
          id?: string
          last_name: string
          organization_id: string
          patient_hash: string
          patient_id?: string | null
          status?: string
          time_added?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          organization_id?: string
          patient_hash?: string
          patient_id?: string | null
          status?: string
          time_added?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_waiting_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_waiting_queue_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_waiting_queue_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hospital_patients_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_benchmarks: {
        Row: {
          created_at: string
          data_year: number
          id: string
          industry_avg: number | null
          industry_bottom_quartile: number | null
          industry_top_quartile: number | null
          metric_label: string
          metric_name: string
          sector: string
          source: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_year?: number
          id?: string
          industry_avg?: number | null
          industry_bottom_quartile?: number | null
          industry_top_quartile?: number | null
          metric_label: string
          metric_name: string
          sector: string
          source?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_year?: number
          id?: string
          industry_avg?: number | null
          industry_bottom_quartile?: number | null
          industry_top_quartile?: number | null
          metric_label?: string
          metric_name?: string
          sector?: string
          source?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      industry_mappings: {
        Row: {
          dataset_id: string
          field_map: Json | null
          id: string
          template_type: string
        }
        Insert: {
          dataset_id: string
          field_map?: Json | null
          id?: string
          template_type: string
        }
        Update: {
          dataset_id?: string
          field_map?: Json | null
          id?: string
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "industry_mappings_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "user_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      insider_dealing_logs: {
        Row: {
          clearance_badge: string
          clearance_status: string
          created_at: string
          details: string
          event_date: string
          event_type: string
          id: string
          person_name: string
        }
        Insert: {
          clearance_badge: string
          clearance_status: string
          created_at?: string
          details: string
          event_date: string
          event_type: string
          id?: string
          person_name: string
        }
        Update: {
          clearance_badge?: string
          clearance_status?: string
          created_at?: string
          details?: string
          event_date?: string
          event_type?: string
          id?: string
          person_name?: string
        }
        Relationships: []
      }
      meridian_aggregate_reports: {
        Row: {
          confirmed_cases: number | null
          created_at: string
          disease: string
          district: string | null
          epi_week: number
          epi_week_label: string | null
          epi_year: number
          id: string
          incidence_rate: number | null
          is_zero_report: boolean | null
          organization_id: string | null
          probable_cases: number | null
          region: string
          submitted_by: string | null
          suspected_cases: number | null
          total_deaths: number | null
          total_recovered: number | null
          updated_at: string
        }
        Insert: {
          confirmed_cases?: number | null
          created_at?: string
          disease: string
          district?: string | null
          epi_week: number
          epi_week_label?: string | null
          epi_year: number
          id?: string
          incidence_rate?: number | null
          is_zero_report?: boolean | null
          organization_id?: string | null
          probable_cases?: number | null
          region: string
          submitted_by?: string | null
          suspected_cases?: number | null
          total_deaths?: number | null
          total_recovered?: number | null
          updated_at?: string
        }
        Update: {
          confirmed_cases?: number | null
          created_at?: string
          disease?: string
          district?: string | null
          epi_week?: number
          epi_week_label?: string | null
          epi_year?: number
          id?: string
          incidence_rate?: number | null
          is_zero_report?: boolean | null
          organization_id?: string | null
          probable_cases?: number | null
          region?: string
          submitted_by?: string | null
          suspected_cases?: number | null
          total_deaths?: number | null
          total_recovered?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meridian_aggregate_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_cases: {
        Row: {
          cas_risk_score: number | null
          case_classification: string | null
          case_origin: string | null
          case_ref: string
          classifying_user_id: string | null
          community: string | null
          created_at: string
          date_of_classification: string | null
          date_of_investigation: string | null
          date_of_outcome: string | null
          date_of_report: string | null
          disease: string
          disease_variant: string | null
          district: string | null
          epid_number: string | null
          external_token: string | null
          facility: string | null
          id: string
          internal_token: string | null
          investigation_status: string | null
          organization_id: string | null
          outbreak_cluster_id: string | null
          outcome: string | null
          person_id: string | null
          point_of_entry: string | null
          region: string | null
          reporting_user_id: string | null
          sequelae: string | null
          sequelae_description: string | null
          updated_at: string
        }
        Insert: {
          cas_risk_score?: number | null
          case_classification?: string | null
          case_origin?: string | null
          case_ref?: string
          classifying_user_id?: string | null
          community?: string | null
          created_at?: string
          date_of_classification?: string | null
          date_of_investigation?: string | null
          date_of_outcome?: string | null
          date_of_report?: string | null
          disease: string
          disease_variant?: string | null
          district?: string | null
          epid_number?: string | null
          external_token?: string | null
          facility?: string | null
          id?: string
          internal_token?: string | null
          investigation_status?: string | null
          organization_id?: string | null
          outbreak_cluster_id?: string | null
          outcome?: string | null
          person_id?: string | null
          point_of_entry?: string | null
          region?: string | null
          reporting_user_id?: string | null
          sequelae?: string | null
          sequelae_description?: string | null
          updated_at?: string
        }
        Update: {
          cas_risk_score?: number | null
          case_classification?: string | null
          case_origin?: string | null
          case_ref?: string
          classifying_user_id?: string | null
          community?: string | null
          created_at?: string
          date_of_classification?: string | null
          date_of_investigation?: string | null
          date_of_outcome?: string | null
          date_of_report?: string | null
          disease?: string
          disease_variant?: string | null
          district?: string | null
          epid_number?: string | null
          external_token?: string | null
          facility?: string | null
          id?: string
          internal_token?: string | null
          investigation_status?: string | null
          organization_id?: string | null
          outbreak_cluster_id?: string | null
          outcome?: string | null
          person_id?: string | null
          point_of_entry?: string | null
          region?: string | null
          reporting_user_id?: string | null
          sequelae?: string | null
          sequelae_description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meridian_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_cases_outbreak_cluster_id_fkey"
            columns: ["outbreak_cluster_id"]
            isOneToOne: false
            referencedRelation: "meridian_outbreak_declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_cases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "meridian_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_contacts: {
        Row: {
          contact_classification: string | null
          contact_person_id: string | null
          contact_ref: string
          contact_status: string | null
          converted_to_case_id: string | null
          created_at: string
          disease: string
          follow_up_end: string | null
          follow_up_start: string | null
          follow_up_status: string | null
          id: string
          missed_visits: number | null
          number_of_visits: number | null
          organization_id: string | null
          source_case_id: string | null
          type_of_contact: string | null
          updated_at: string
          vaccination_status: string | null
        }
        Insert: {
          contact_classification?: string | null
          contact_person_id?: string | null
          contact_ref?: string
          contact_status?: string | null
          converted_to_case_id?: string | null
          created_at?: string
          disease: string
          follow_up_end?: string | null
          follow_up_start?: string | null
          follow_up_status?: string | null
          id?: string
          missed_visits?: number | null
          number_of_visits?: number | null
          organization_id?: string | null
          source_case_id?: string | null
          type_of_contact?: string | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Update: {
          contact_classification?: string | null
          contact_person_id?: string | null
          contact_ref?: string
          contact_status?: string | null
          converted_to_case_id?: string | null
          created_at?: string
          disease?: string
          follow_up_end?: string | null
          follow_up_start?: string | null
          follow_up_status?: string | null
          id?: string
          missed_visits?: number | null
          number_of_visits?: number | null
          organization_id?: string | null
          source_case_id?: string | null
          type_of_contact?: string | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meridian_contacts_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "meridian_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_contacts_converted_to_case_id_fkey"
            columns: ["converted_to_case_id"]
            isOneToOne: false
            referencedRelation: "meridian_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_contacts_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "meridian_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_immunizations: {
        Row: {
          created_at: string
          date_of_recovery: string | null
          disease: string
          end_date: string | null
          id: string
          immunization_status: string | null
          management_status: string | null
          means_of_immunization: string | null
          organization_id: string | null
          person_id: string | null
          start_date: string | null
          updated_at: string
          vaccine_type: string | null
        }
        Insert: {
          created_at?: string
          date_of_recovery?: string | null
          disease: string
          end_date?: string | null
          id?: string
          immunization_status?: string | null
          management_status?: string | null
          means_of_immunization?: string | null
          organization_id?: string | null
          person_id?: string | null
          start_date?: string | null
          updated_at?: string
          vaccine_type?: string | null
        }
        Update: {
          created_at?: string
          date_of_recovery?: string | null
          disease?: string
          end_date?: string | null
          id?: string
          immunization_status?: string | null
          management_status?: string | null
          means_of_immunization?: string | null
          organization_id?: string | null
          person_id?: string | null
          start_date?: string | null
          updated_at?: string
          vaccine_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meridian_immunizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meridian_immunizations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "meridian_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_outbreak_declarations: {
        Row: {
          cas_threshold_override: number | null
          created_at: string
          declared_at: string | null
          declared_by: string | null
          disease: string
          district: string
          id: string
          organization_id: string | null
          region: string
          resolved_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          cas_threshold_override?: number | null
          created_at?: string
          declared_at?: string | null
          declared_by?: string | null
          disease: string
          district: string
          id?: string
          organization_id?: string | null
          region: string
          resolved_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          cas_threshold_override?: number | null
          created_at?: string
          declared_at?: string | null
          declared_by?: string | null
          disease?: string
          district?: string
          id?: string
          organization_id?: string | null
          region?: string
          resolved_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meridian_outbreak_declarations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_persons: {
        Row: {
          community: string | null
          created_at: string
          date_of_birth: string | null
          district: string | null
          first_name: string | null
          id: string
          last_name: string | null
          national_health_id: string | null
          organization_id: string | null
          region: string | null
          sex: string | null
          updated_at: string
        }
        Insert: {
          community?: string | null
          created_at?: string
          date_of_birth?: string | null
          district?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          national_health_id?: string | null
          organization_id?: string | null
          region?: string | null
          sex?: string | null
          updated_at?: string
        }
        Update: {
          community?: string | null
          created_at?: string
          date_of_birth?: string | null
          district?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          national_health_id?: string | null
          organization_id?: string | null
          region?: string | null
          sex?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meridian_persons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_survey_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          disease_focus: string | null
          id: string
          name: string
          organization_id: string | null
          schema: Json
          status: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          disease_focus?: string | null
          id?: string
          name: string
          organization_id?: string | null
          schema?: Json
          status?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          disease_focus?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          schema?: Json
          status?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meridian_survey_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_weekly_compliance: {
        Row: {
          created_at: string
          epi_week: number
          epi_week_label: string | null
          epi_year: number
          id: string
          is_zero_report: boolean | null
          officer_id: string | null
          organization_id: string | null
          region: string | null
          submission_date: string | null
          submitted: boolean | null
        }
        Insert: {
          created_at?: string
          epi_week: number
          epi_week_label?: string | null
          epi_year: number
          id?: string
          is_zero_report?: boolean | null
          officer_id?: string | null
          organization_id?: string | null
          region?: string | null
          submission_date?: string | null
          submitted?: boolean | null
        }
        Update: {
          created_at?: string
          epi_week?: number
          epi_week_label?: string | null
          epi_year?: number
          id?: string
          is_zero_report?: boolean | null
          officer_id?: string | null
          organization_id?: string | null
          region?: string | null
          submission_date?: string | null
          submitted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meridian_weekly_compliance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nigerian_mandates: {
        Row: {
          created_at: string | null
          description: string | null
          framework: string
          id: string
          regulator_id: string | null
          severity: string | null
          submission_frequency: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          framework: string
          id?: string
          regulator_id?: string | null
          severity?: string | null
          submission_frequency?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          framework?: string
          id?: string
          regulator_id?: string | null
          severity?: string | null
          submission_frequency?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "nigerian_mandates_regulator_id_fkey"
            columns: ["regulator_id"]
            isOneToOne: false
            referencedRelation: "nigerian_regulators"
            referencedColumns: ["id"]
          },
        ]
      }
      nigerian_regulators: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          name: string
          sector: string
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          name: string
          sector: string
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          name?: string
          sector?: string
          website_url?: string | null
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          max_uses: number | null
          organization_id: string
          role_preset: string | null
          suite_target: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_uses?: number | null
          organization_id: string
          role_preset?: string | null
          suite_target?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_uses?: number | null
          organization_id?: string
          role_preset?: string | null
          suite_target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_tier_entitlements: {
        Row: {
          created_at: string | null
          next_verification_date: string | null
          organization_id: string
          platform_customer_id: string | null
          platform_subscription_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          next_verification_date?: string | null
          organization_id: string
          platform_customer_id?: string | null
          platform_subscription_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          next_verification_date?: string | null
          organization_id?: string
          platform_customer_id?: string | null
          platform_subscription_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_tier_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          enabled_frameworks: Json | null
          id: string
          logo_url: string | null
          mfa_enforced: boolean | null
          name: string
          sector: string | null
          settings: Json | null
          slug: string
          status: string | null
          suites_enabled: Json | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled_frameworks?: Json | null
          id?: string
          logo_url?: string | null
          mfa_enforced?: boolean | null
          name: string
          sector?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          suites_enabled?: Json | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled_frameworks?: Json | null
          id?: string
          logo_url?: string | null
          mfa_enforced?: boolean | null
          name?: string
          sector?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          suites_enabled?: Json | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      private_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          fts: unknown
          id: string
          metadata: Json | null
          organization_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          metadata?: Json | null
          organization_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          metadata?: Json | null
          organization_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_knowledge_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          contact_phone: string | null
          created_at: string | null
          email: string
          entity_name: string | null
          failed_attempts: number | null
          full_name: string | null
          has_seen_onboarding: boolean
          id: string
          is_org_admin: boolean | null
          is_partner_admin: boolean | null
          lockout_until: string | null
          mfa_skipped_at: string | null
          organization_id: string | null
          rc_number: string | null
          staff_type: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          tenant_id: string | null
          updated_at: string | null
          whatsapp_link_code: string | null
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string | null
          email: string
          entity_name?: string | null
          failed_attempts?: number | null
          full_name?: string | null
          has_seen_onboarding?: boolean
          id: string
          is_org_admin?: boolean | null
          is_partner_admin?: boolean | null
          lockout_until?: string | null
          mfa_skipped_at?: string | null
          organization_id?: string | null
          rc_number?: string | null
          staff_type?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          whatsapp_link_code?: string | null
        }
        Update: {
          contact_phone?: string | null
          created_at?: string | null
          email?: string
          entity_name?: string | null
          failed_attempts?: number | null
          full_name?: string | null
          has_seen_onboarding?: boolean
          id?: string
          is_org_admin?: boolean | null
          is_partner_admin?: boolean | null
          lockout_until?: string | null
          mfa_skipped_at?: string | null
          organization_id?: string | null
          rc_number?: string | null
          staff_type?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          whatsapp_link_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_alert_reads: {
        Row: {
          alert_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          alert_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_alert_reads_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "regulatory_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_alerts: {
        Row: {
          body: string
          created_at: string
          effective_date: string | null
          framework: string
          id: string
          is_active: boolean
          severity: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          effective_date?: string | null
          framework: string
          id?: string
          is_active?: boolean
          severity?: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          effective_date?: string | null
          framework?: string
          id?: string
          is_active?: boolean
          severity?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          compliance_framework:
            | Database["public"]["Enums"]["compliance_framework"]
            | null
          compliance_frameworks: string[] | null
          created_at: string | null
          created_by: string | null
          default_risks: Json | null
          default_targets: Json | null
          description: string | null
          id: string
          industry: string
          is_deleted: boolean | null
          name: string
          report_category: string
          updated_at: string | null
        }
        Insert: {
          compliance_framework?:
            | Database["public"]["Enums"]["compliance_framework"]
            | null
          compliance_frameworks?: string[] | null
          created_at?: string | null
          created_by?: string | null
          default_risks?: Json | null
          default_targets?: Json | null
          description?: string | null
          id?: string
          industry: string
          is_deleted?: boolean | null
          name: string
          report_category?: string
          updated_at?: string | null
        }
        Update: {
          compliance_framework?:
            | Database["public"]["Enums"]["compliance_framework"]
            | null
          compliance_frameworks?: string[] | null
          created_at?: string | null
          created_by?: string | null
          default_risks?: Json | null
          default_targets?: Json | null
          description?: string | null
          id?: string
          industry?: string
          is_deleted?: boolean | null
          name?: string
          report_category?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      report_versions: {
        Row: {
          carbon_total: number | null
          change_description: string | null
          changed_by: string | null
          company_name: string | null
          compliance_frameworks: string[] | null
          contact_person: string | null
          created_at: string | null
          id: string
          report_id: string
          reporting_year: number | null
          risks: Json | null
          snapshot_data: Json
          status: string | null
          targets: Json | null
          version_number: number
        }
        Insert: {
          carbon_total?: number | null
          change_description?: string | null
          changed_by?: string | null
          company_name?: string | null
          compliance_frameworks?: string[] | null
          contact_person?: string | null
          created_at?: string | null
          id?: string
          report_id: string
          reporting_year?: number | null
          risks?: Json | null
          snapshot_data: Json
          status?: string | null
          targets?: Json | null
          version_number: number
        }
        Update: {
          carbon_total?: number | null
          change_description?: string | null
          changed_by?: string | null
          company_name?: string | null
          compliance_frameworks?: string[] | null
          contact_person?: string | null
          created_at?: string | null
          id?: string
          report_id?: string
          reporting_year?: number | null
          risks?: Json | null
          snapshot_data?: Json
          status?: string | null
          targets?: Json | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          board_size: number | null
          carbon_total: number | null
          company_name: string
          compliance_framework: string[] | null
          compliance_frameworks: string[] | null
          contact_person: string
          created_at: string | null
          created_by: string
          current_ratio: number | null
          debt_to_equity: number | null
          diesel_liters: number | null
          diversity_ratio: number | null
          framework_responses: Json | null
          grid_kwh: number | null
          id: string
          independent_directors: number | null
          petrol_liters: number | null
          previous_status: string | null
          report_category: string
          reporting_quarter: number | null
          reporting_year: number
          return_on_equity: number | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          risks: Json | null
          safety_incidents: number | null
          status: Database["public"]["Enums"]["report_status"]
          targets: Json | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          board_size?: number | null
          carbon_total?: number | null
          company_name: string
          compliance_framework?: string[] | null
          compliance_frameworks?: string[] | null
          contact_person: string
          created_at?: string | null
          created_by: string
          current_ratio?: number | null
          debt_to_equity?: number | null
          diesel_liters?: number | null
          diversity_ratio?: number | null
          framework_responses?: Json | null
          grid_kwh?: number | null
          id?: string
          independent_directors?: number | null
          petrol_liters?: number | null
          previous_status?: string | null
          report_category?: string
          reporting_quarter?: number | null
          reporting_year: number
          return_on_equity?: number | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          risks?: Json | null
          safety_incidents?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          targets?: Json | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          board_size?: number | null
          carbon_total?: number | null
          company_name?: string
          compliance_framework?: string[] | null
          compliance_frameworks?: string[] | null
          contact_person?: string
          created_at?: string | null
          created_by?: string
          current_ratio?: number | null
          debt_to_equity?: number | null
          diesel_liters?: number | null
          diversity_ratio?: number | null
          framework_responses?: Json | null
          grid_kwh?: number | null
          id?: string
          independent_directors?: number | null
          petrol_liters?: number | null
          previous_status?: string | null
          report_category?: string
          reporting_quarter?: number | null
          reporting_year?: number
          return_on_equity?: number | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          risks?: Json | null
          safety_incidents?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          targets?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_reports_profiles"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_event_nodes: {
        Row: {
          created_at: string
          event_id: string
          node_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          node_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_event_nodes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sentinel_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_event_nodes_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "sentinel_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_events: {
        Row: {
          ai_analysis: Json | null
          cameo_code: string | null
          city: string | null
          country_code: string | null
          embedding: string | null
          event_type: string | null
          fts: unknown
          full_text: string | null
          headline: string
          id: string
          ingested_at: string
          lat: number | null
          lng: number | null
          merged_into_id: string | null
          occurred_at: string
          organization_id: string | null
          raw_acled: Json | null
          raw_gdelt: Json | null
          region: string | null
          severity: number | null
          source_credibility: number | null
          source_url: string | null
          source_url_unique: string | null
          tone: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          cameo_code?: string | null
          city?: string | null
          country_code?: string | null
          embedding?: string | null
          event_type?: string | null
          fts?: unknown
          full_text?: string | null
          headline: string
          id?: string
          ingested_at?: string
          lat?: number | null
          lng?: number | null
          merged_into_id?: string | null
          occurred_at?: string
          organization_id?: string | null
          raw_acled?: Json | null
          raw_gdelt?: Json | null
          region?: string | null
          severity?: number | null
          source_credibility?: number | null
          source_url?: string | null
          source_url_unique?: string | null
          tone?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          cameo_code?: string | null
          city?: string | null
          country_code?: string | null
          embedding?: string | null
          event_type?: string | null
          fts?: unknown
          full_text?: string | null
          headline?: string
          id?: string
          ingested_at?: string
          lat?: number | null
          lng?: number | null
          merged_into_id?: string | null
          occurred_at?: string
          organization_id?: string | null
          raw_acled?: Json | null
          raw_gdelt?: Json | null
          region?: string | null
          severity?: number | null
          source_credibility?: number | null
          source_url?: string | null
          source_url_unique?: string | null
          tone?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_events_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "sentinel_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_graph_edges: {
        Row: {
          created_at: string
          id: string
          relationship: string
          source_node_id: string | null
          target_node_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          relationship: string
          source_node_id?: string | null
          target_node_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          relationship?: string
          source_node_id?: string | null
          target_node_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_graph_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "sentinel_graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_graph_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "sentinel_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_graph_nodes: {
        Row: {
          created_at: string
          id: string
          label: string
          metadata: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          metadata?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: []
      }
      sentinel_risk_scores: {
        Row: {
          computed_at: string
          country_code: string
          economy_score: number | null
          event_count: number | null
          id: string
          score: number
          security_score: number | null
          social_score: number | null
        }
        Insert: {
          computed_at?: string
          country_code: string
          economy_score?: number | null
          event_count?: number | null
          id?: string
          score: number
          security_score?: number | null
          social_score?: number | null
        }
        Update: {
          computed_at?: string
          country_code?: string
          economy_score?: number | null
          event_count?: number | null
          id?: string
          score?: number
          security_score?: number | null
          social_score?: number | null
        }
        Relationships: []
      }
      social_metrics: {
        Row: {
          average_training_hours_per_employee: number | null
          board_ethnic_minority: number | null
          board_female: number | null
          board_total: number | null
          charitable_donations: number | null
          community_investment_amount: number | null
          contractors: number | null
          created_at: string | null
          created_by: string
          employee_satisfaction_score: number | null
          employee_turnover_rate: string | null
          ethnic_minority_employees: number | null
          fatalities: number | null
          female_employees: number | null
          full_time_employees: number | null
          id: string
          leadership_female: number | null
          leadership_total: number | null
          lost_time_injuries: number | null
          male_employees: number | null
          near_misses: number | null
          non_binary_employees: number | null
          part_time_employees: number | null
          report_id: string
          safety_training_hours: number | null
          total_employees: number | null
          total_recordable_injuries: number | null
          total_training_hours: number | null
          training_investment_amount: number | null
          updated_at: string | null
          volunteer_hours: number | null
        }
        Insert: {
          average_training_hours_per_employee?: number | null
          board_ethnic_minority?: number | null
          board_female?: number | null
          board_total?: number | null
          charitable_donations?: number | null
          community_investment_amount?: number | null
          contractors?: number | null
          created_at?: string | null
          created_by: string
          employee_satisfaction_score?: number | null
          employee_turnover_rate?: string | null
          ethnic_minority_employees?: number | null
          fatalities?: number | null
          female_employees?: number | null
          full_time_employees?: number | null
          id?: string
          leadership_female?: number | null
          leadership_total?: number | null
          lost_time_injuries?: number | null
          male_employees?: number | null
          near_misses?: number | null
          non_binary_employees?: number | null
          part_time_employees?: number | null
          report_id: string
          safety_training_hours?: number | null
          total_employees?: number | null
          total_recordable_injuries?: number | null
          total_training_hours?: number | null
          training_investment_amount?: number | null
          updated_at?: string | null
          volunteer_hours?: number | null
        }
        Update: {
          average_training_hours_per_employee?: number | null
          board_ethnic_minority?: number | null
          board_female?: number | null
          board_total?: number | null
          charitable_donations?: number | null
          community_investment_amount?: number | null
          contractors?: number | null
          created_at?: string | null
          created_by?: string
          employee_satisfaction_score?: number | null
          employee_turnover_rate?: string | null
          ethnic_minority_employees?: number | null
          fatalities?: number | null
          female_employees?: number | null
          full_time_employees?: number | null
          id?: string
          leadership_female?: number | null
          leadership_total?: number | null
          lost_time_injuries?: number | null
          male_employees?: number | null
          near_misses?: number | null
          non_binary_employees?: number | null
          part_time_employees?: number | null
          report_id?: string
          safety_training_hours?: number | null
          total_employees?: number | null
          total_recordable_injuries?: number | null
          total_training_hours?: number | null
          training_investment_amount?: number | null
          updated_at?: string | null
          volunteer_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_metrics_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          id: number
          lockdown_mode: boolean
          lockout_duration_seconds: number | null
          max_login_attempts: number | null
          sanction_threshold: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: number
          lockdown_mode?: boolean
          lockout_duration_seconds?: number | null
          max_login_attempts?: number | null
          sanction_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          lockdown_mode?: boolean
          lockout_duration_seconds?: number | null
          max_login_attempts?: number | null
          sanction_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      target_progress: {
        Row: {
          actual_value: number | null
          created_at: string | null
          created_by: string
          id: string
          measurement_date: string | null
          notes: string | null
          report_id: string
          target_category: string | null
          target_name: string
          target_value: number | null
          unit: string | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          created_by: string
          id?: string
          measurement_date?: string | null
          notes?: string | null
          report_id: string
          target_category?: string | null
          target_name: string
          target_value?: number | null
          unit?: string | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          created_by?: string
          id?: string
          measurement_date?: string | null
          notes?: string | null
          report_id?: string
          target_category?: string | null
          target_name?: string
          target_value?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_progress_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          custom_domain: string | null
          logo_url: string | null
          primary_color_hex: string | null
          secondary_color_hex: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          custom_domain?: string | null
          logo_url?: string | null
          primary_color_hex?: string | null
          secondary_color_hex?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          custom_domain?: string | null
          logo_url?: string | null
          primary_color_hex?: string | null
          secondary_color_hex?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          enabled_frameworks: Json | null
          id: string
          name: string
          status: string | null
          suites_enabled: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled_frameworks?: Json | null
          id?: string
          name: string
          status?: string | null
          suites_enabled?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled_frameworks?: Json | null
          id?: string
          name?: string
          status?: string | null
          suites_enabled?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      transaction_ledger: {
        Row: {
          action_type: Database["public"]["Enums"]["ledger_action_type"]
          created_at: string
          created_by: string
          evidence_id: string | null
          id: string
          line_item_description: string
          quantity: number
          report_id: string | null
          reverses_ledger_id: string | null
          transaction_date: string
          unit: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["ledger_action_type"]
          created_at?: string
          created_by: string
          evidence_id?: string | null
          id?: string
          line_item_description: string
          quantity: number
          report_id?: string | null
          reverses_ledger_id?: string | null
          transaction_date: string
          unit: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["ledger_action_type"]
          created_at?: string
          created_by?: string
          evidence_id?: string | null
          id?: string
          line_item_description?: string
          quantity?: number
          report_id?: string | null
          reverses_ledger_id?: string | null
          transaction_date?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_ledger_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ledger_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ledger_reverses_ledger_id_fkey"
            columns: ["reverses_ledger_id"]
            isOneToOne: false
            referencedRelation: "transaction_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      user_datasets: {
        Row: {
          created_at: string
          dashboard_config: Json | null
          id: string
          is_public: boolean | null
          name: string
          raw_payload: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_config?: Json | null
          id?: string
          is_public?: boolean | null
          name: string
          raw_payload?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_config?: Json | null
          id?: string
          is_public?: boolean | null
          name?: string
          raw_payload?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_datasets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          id: string
          monthly_digest: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
          weekly_digest: boolean | null
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          monthly_digest?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
          weekly_digest?: boolean | null
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          monthly_digest?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cas_training_samples: {
        Row: {
          created_at: string | null
          effectiveness_score: number | null
          env_alert_count: number | null
          id: string | null
          op_flag_count: number | null
          patient_count: number | null
          resolution_status: string | null
        }
        Insert: {
          created_at?: string | null
          effectiveness_score?: number | null
          env_alert_count?: number | null
          id?: string | null
          op_flag_count?: number | null
          patient_count?: number | null
          resolution_status?: string | null
        }
        Update: {
          created_at?: string | null
          effectiveness_score?: number | null
          env_alert_count?: number | null
          id?: string | null
          op_flag_count?: number | null
          patient_count?: number | null
          resolution_status?: string | null
        }
        Relationships: []
      }
      hospital_patients: {
        Row: {
          archived_at: string | null
          created_at: string | null
          date_of_birth: string | null
          first_name: string | null
          gender: string | null
          hmo_consent_given: boolean | null
          hmo_enrollee_id: string | null
          hmo_provider_id: string | null
          id: string | null
          is_estimated_dob: boolean | null
          last_name: string | null
          organization_id: string | null
          outstanding_balance: number | null
          phone_number: string | null
          qr_code_hash: string | null
          searchable_id: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: never
          gender?: string | null
          hmo_consent_given?: boolean | null
          hmo_enrollee_id?: string | null
          hmo_provider_id?: string | null
          id?: string | null
          is_estimated_dob?: boolean | null
          last_name?: never
          organization_id?: string | null
          outstanding_balance?: number | null
          phone_number?: never
          qr_code_hash?: string | null
          searchable_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: never
          gender?: string | null
          hmo_consent_given?: boolean | null
          hmo_enrollee_id?: string | null
          hmo_provider_id?: string | null
          id?: string | null
          is_estimated_dob?: boolean | null
          last_name?: never
          organization_id?: string | null
          outstanding_balance?: number | null
          phone_number?: never
          qr_code_hash?: string | null
          searchable_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_patients_secure_hmo_provider_id_fkey"
            columns: ["hmo_provider_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meridian_system_evolution_stats: {
        Row: {
          action_type: string | null
          avg_effectiveness: number | null
          failure_count: number | null
          success_count: number | null
          total_interventions: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_patient_balance: {
        Args: { p_amount: number; p_patient_id: string }
        Returns: number
      }
      adjust_inventory: {
        Args: { p_amount: number; p_id: string }
        Returns: number
      }
      admin_diagnostic: { Args: never; Returns: Json }
      check_sanction_hit: { Args: { search_name: string }; Returns: boolean }
      check_velocity: { Args: never; Returns: undefined }
      clear_patient_balance: {
        Args: { p_patient_id: string }
        Returns: undefined
      }
      create_sovereign_node: {
        Args: { org_name: string; org_rc_number: string; org_sector: string }
        Returns: string
      }
      decrypt_phi: { Args: { data: string }; Returns: string }
      deduplicate_sentinel_events: { Args: never; Returns: number }
      delete_organization: {
        Args: { target_org_id: string }
        Returns: undefined
      }
      encrypt_phi: { Args: { data: string }; Returns: string }
      fn_calibrate_cas_weights: {
        Args: { epochs?: number; lr?: number }
        Returns: undefined
      }
      fn_epi_week_label: { Args: { p_date: string }; Returns: string }
      fn_epi_week_number: { Args: { p_date: string }; Returns: number }
      fn_epi_year_number: { Args: { p_date: string }; Returns: number }
      fn_get_epi_week: {
        Args: { p_date: string }
        Returns: {
          epi_week: number
          epi_year: number
        }[]
      }
      fn_meridian_compliance_summary: {
        Args: { p_epi_week: number; p_epi_year: number; p_org_id?: string }
        Returns: {
          region: string
          submission_pct: number
          submitted_count: number
          total_officers: number
          zero_report_count: number
        }[]
      }
      fn_simulate_payment_verification: { Args: never; Returns: number }
      get_event_impact_markdown: {
        Args: { p_event_id: string; p_max_depth?: number }
        Returns: string
      }
      get_event_timeline_bins: {
        Args: { p_country_code?: string; p_hours?: number }
        Returns: {
          event_count: number
          hour_label: string
        }[]
      }
      get_latest_risk_score: {
        Args: { p_country_code: string }
        Returns: {
          computed_at: string
          country_code: string
          economy_score: number
          event_count: number
          score: number
          security_score: number
          social_score: number
        }[]
      }
      get_my_partner_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_safe: {
        Args: { _role_name: string; _user_id: string }
        Returns: boolean
      }
      hash_phi: { Args: { data: string }; Returns: string }
      hybrid_search_events: {
        Args: {
          p_country_code?: string
          p_end_date?: string
          p_full_text_weight?: number
          p_match_count?: number
          p_min_severity?: number
          p_query_embedding: string
          p_query_text: string
          p_rrf_k?: number
          p_semantic_weight?: number
          p_start_date?: string
        }
        Returns: {
          ai_analysis: Json
          country_code: string
          event_type: string
          headline: string
          id: string
          occurred_at: string
          severity: number
          similarity: number
        }[]
      }
      hybrid_search_private_knowledge: {
        Args: {
          p_full_text_weight?: number
          p_match_count?: number
          p_organization_id: string
          p_query_embedding: string
          p_query_text: string
          p_rrf_k?: number
          p_semantic_weight?: number
        }
        Returns: {
          content: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
          title: string
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_org_admin_for_org: { Args: { _org_id: string }; Returns: boolean }
      is_partner_admin_for_org: {
        Args: { _target_org_id: string; _viewer_id: string }
        Returns: boolean
      }
      is_system_locked: { Args: never; Returns: boolean }
      join_clinic_with_code: { Args: { p_code: string }; Returns: Json }
      log_patient_transaction: {
        Args: {
          p_amount: number
          p_description: string
          p_org_id: string
          p_patient_id: string
          p_payment_method: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      log_security_event: {
        Args: { details: Json; event_type: string }
        Returns: undefined
      }
      record_failed_login: { Args: { target_email: string }; Returns: Json }
      reset_user_lockout: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      semantic_search_events: {
        Args: {
          match_count?: number
          p_country_code?: string
          query_embedding: string
        }
        Returns: {
          ai_analysis: Json
          country_code: string
          event_type: string
          headline: string
          id: string
          occurred_at: string
          severity: number
          similarity: number
        }[]
      }
      test_insert_patient: { Args: { p_org_id: string }; Returns: Json }
      update_org_mfa_policy: {
        Args: { enforced: boolean; target_org_id: string }
        Returns: undefined
      }
      upsert_graph_subnetwork: {
        Args: { p_edges: Json; p_event_id: string; p_nodes: Json }
        Returns: undefined
      }
      verify_api_key: { Args: { input_key: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "approver"
        | "auditor"
        | "meridian_surveyor"
        | "meridian_agent"
        | "meridian_exec"
        | "meridian_liaison"
        | "data_intelligence_admin"
        | "data_studio_user"
        | "concord_operator"
        | "concord_verifier"
        | "concord_exec"
        | "partner"
        | "hospital_admin"
        | "hospital_staff"
        | "epicenter_exec"
        | "epicenter_liaison"
        | "epicenter_surveyor"
        | "epicenter_agent"
        | "hmo_admin"
        | "sentinel_analyst"
        | "sentinel_exec"
      compliance_framework:
        | "GRI"
        | "SASB"
        | "TCFD"
        | "CSRD_ESRS"
        | "GRI_11"
        | "NSBP"
        | "NESREA"
        | "NONE"
        | "IFRS"
        | "GAAP"
        | "IPSAS"
        | "CAMA"
      esg_category:
        | "environment"
        | "social"
        | "governance"
        | "financial"
        | "operational"
        | "legal"
        | "technological"
        | "reputational"
      ledger_action_type:
        | "evidence_submission"
        | "correction"
        | "reversal"
        | "audit_adjustment"
      report_status: "draft" | "submitted" | "approved"
      user_status: "pending" | "active" | "suspended" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "editor",
        "approver",
        "auditor",
        "meridian_surveyor",
        "meridian_agent",
        "meridian_exec",
        "meridian_liaison",
        "data_intelligence_admin",
        "data_studio_user",
        "concord_operator",
        "concord_verifier",
        "concord_exec",
        "partner",
        "hospital_admin",
        "hospital_staff",
        "epicenter_exec",
        "epicenter_liaison",
        "epicenter_surveyor",
        "epicenter_agent",
        "hmo_admin",
        "sentinel_analyst",
        "sentinel_exec",
      ],
      compliance_framework: [
        "GRI",
        "SASB",
        "TCFD",
        "CSRD_ESRS",
        "GRI_11",
        "NSBP",
        "NESREA",
        "NONE",
        "IFRS",
        "GAAP",
        "IPSAS",
        "CAMA",
      ],
      esg_category: [
        "environment",
        "social",
        "governance",
        "financial",
        "operational",
        "legal",
        "technological",
        "reputational",
      ],
      ledger_action_type: [
        "evidence_submission",
        "correction",
        "reversal",
        "audit_adjustment",
      ],
      report_status: ["draft", "submitted", "approved"],
      user_status: ["pending", "active", "suspended", "rejected"],
    },
  },
} as const
