import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

export function useFollow(targetUserId: string) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // 1. Check if following
    const { data: isFollowing, isLoading } = useQuery({
        queryKey: ['is_following', targetUserId, user?.id],
        queryFn: async () => {
            if (!user) return false;
            const { data, error } = await supabase
                .from('follows')
                .select('*')
                .eq('follower_id', user.id)
                .eq('following_id', targetUserId)
                .single();
            
            if (error && error.code !== 'PGRST116') {
               console.error("Error checking follow status:", error);
            }
            return !!data;
        },
        enabled: !!user && !!targetUserId && user.id !== targetUserId,
        initialData: false
    });

    // 2. Fetch follower count
    const { data: followerCount } = useQuery({
        queryKey: ['follower_count', targetUserId],
        queryFn: async () => {
             const { count, error } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', targetUserId);
             
             if (error) console.error("Error fetching follower count:", error);
             return count || 0;
        },
        initialData: 0
    });

    // 3. Toggle Follow Mutation
    const followMutation = useMutation({
        mutationFn: async (shouldFollow: boolean) => {
            if (!user) throw new Error("Unauthorized");
            
            if (shouldFollow) {
                const { error } = await supabase
                    .from('follows')
                    .insert({
                        follower_id: user.id,
                        following_id: targetUserId
                    } as any);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', user.id)
                    .eq('following_id', targetUserId);
                if (error) throw error;
            }
        },
        onMutate: async (shouldFollow) => {
            await queryClient.cancelQueries({ queryKey: ['is_following', targetUserId, user?.id] });
            await queryClient.cancelQueries({ queryKey: ['follower_count', targetUserId] });

            const prevIsFollowing = queryClient.getQueryData(['is_following', targetUserId, user?.id]);
            const prevCount = queryClient.getQueryData<number>(['follower_count', targetUserId]) || 0;

            queryClient.setQueryData(['is_following', targetUserId, user?.id], shouldFollow);
            queryClient.setQueryData(['follower_count', targetUserId], shouldFollow ? prevCount + 1 : Math.max(0, prevCount - 1));

            return { prevIsFollowing, prevCount };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(['is_following', targetUserId, user?.id], context?.prevIsFollowing);
            queryClient.setQueryData(['follower_count', targetUserId], context?.prevCount);
            toast({
                title: "操作失败",
                description: "请稍后重试",
                variant: "destructive"
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['is_following', targetUserId, user?.id] });
            queryClient.invalidateQueries({ queryKey: ['follower_count', targetUserId] });
        }
    });

    return {
        isFollowing,
        isLoading,
        followerCount,
        follow: () => followMutation.mutate(true),
        unfollow: () => followMutation.mutate(false),
        isPending: followMutation.isPending
    };
}
