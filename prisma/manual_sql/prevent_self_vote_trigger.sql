-- Prevent members from voting on their own comments
-- Run this in your Supabase SQL Editor

-- Create the trigger function
create or replace function prevent_member_self_vote()
returns trigger as $$
begin
  if exists (
    select 1
    from "Comment" c
    where c.id = NEW."commentId"
      and c."authorId" = NEW."voterId"
  ) then
    raise exception 'Members cannot vote on their own comments';
  end if;

  return NEW;
end;
$$ language plpgsql;

-- Drop existing trigger if it exists
drop trigger if exists trg_prevent_member_self_vote on "CommentMemberVote";

-- Create the trigger on INSERT and UPDATE
create trigger trg_prevent_member_self_vote
before insert or update on "CommentMemberVote"
for each row execute function prevent_member_self_vote();

-- Verify it was created
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgname = 'trg_prevent_member_self_vote';
