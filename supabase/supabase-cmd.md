# Auth
supabase login                          # Login to your account (one-time)
supabase link --project-ref <ref>       # Link local repo to remote project (one-time)

# Database
supabase db push                        # Push all migration files to remote DB
supabase db pull                        # Pull remote schema into local migrations
supabase db dump                        # Export full DB as SQL (for backups/transfers)

# Edge Functions
supabase functions serve                # Run functions locally for testing
supabase functions deploy               # Deploy ALL functions
supabase functions deploy <name>        # Deploy one specific function

# Secrets
supabase secrets set KEY="value"        # Set env var for edge functions
supabase secrets list                   # See what secrets are set

# Local dev (needs Docker)
supabase start                          # Run full local Supabase (DB, Auth, etc.)
supabase stop                           # Stop local instance