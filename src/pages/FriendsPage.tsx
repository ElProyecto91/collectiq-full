import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useFollows, searchUsers, type PublicUser } from '@/hooks/use-follows';
import { useUserStore } from '@/store';

export function FriendsPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { following, followers, follow, unfollow, isFollowing } = useFollows();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'following' | 'followers'>('search');

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    try {
      const users = await searchUsers(q);
      setResults(users.filter(u => u.telegram_user_id !== telegramUser?.id));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">Amigos</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{following.length}</p>
            <p className="text-xs text-gray-500">Siguiendo</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-purple-400">{followers.length}</p>
            <p className="text-xs text-gray-500">Seguidores</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          {[
            { key: 'search', label: 'Buscar' },
            { key: 'following', label: 'Siguiendo' },
            { key: 'followers', label: 'Seguidores' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={'flex-1 py-2 rounded-lg text-xs font-medium transition-colors ' + (activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400')}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'search' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={query} onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar por nombre o @usuario..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
            </div>

            {results.length === 0 && query.trim() && !isSearching && (
              <p className="text-center text-gray-500 text-sm py-8">No se encontraron usuarios</p>
            )}

            {!query.trim() && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Busca usuarios por nombre o @usuario</p>
              </div>
            )}

            <div className="space-y-2">
              {results.map(user => (
                <UserCard key={user.telegram_user_id} user={user}
                  isFollowing={isFollowing(user.telegram_user_id)}
                  onFollow={() => follow(user.telegram_user_id)}
                  onUnfollow={() => unfollow(user.telegram_user_id)}
                  onView={() => navigate('/u/' + user.telegram_user_id)} />
              ))}
            </div>
          </>
        )}

        {activeTab === 'following' && (
          <div className="space-y-2">
            {following.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Aun no sigues a nadie</p>
                <p className="text-xs mt-1">Busca usuarios en la pestana Buscar</p>
              </div>
            ) : (
              following.map(userId => (
                <div key={userId} className="flex items-center gap-3 bg-[#111118] border border-white/8 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-400 font-bold text-sm">U</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Usuario {userId}</p>
                  </div>
                  <button onClick={() => unfollow(userId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <UserMinus size={12} />
                    Dejar
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="space-y-2">
            {followers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Aun no tienes seguidores</p>
                <p className="text-xs mt-1">Comparte tu coleccion para que te encuentren</p>
              </div>
            ) : (
              followers.map(userId => (
                <div key={userId} className="flex items-center gap-3 bg-[#111118] border border-white/8 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0">
                    <span className="text-purple-400 font-bold text-sm">U</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Usuario {userId}</p>
                  </div>
                  <button onClick={() => isFollowing(userId) ? unfollow(userId) : follow(userId)}
                    className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ' + (
                      isFollowing(userId)
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    )}>
                    {isFollowing(userId) ? <><UserMinus size={12} /> Dejar</> : <><UserPlus size={12} /> Seguir</>}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({ user, isFollowing, onFollow, onUnfollow, onView }: {
  user: PublicUser;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onView: () => void;
}) {
  const displayName = user.first_name ?? user.username ?? 'Usuario';
  const handle = user.username ? '@' + user.username : null;

  return (
    <div className="flex items-center gap-3 bg-[#111118] border border-white/8 rounded-xl px-4 py-3">
      <div onClick={onView} className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 cursor-pointer">
        <span className="text-blue-400 font-bold text-sm">{displayName[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
        <p className="text-sm font-bold text-white truncate">{displayName}</p>
        {handle && <p className="text-xs text-gray-500">{handle}</p>}
        <p className="text-[10px] text-gray-600 mt-0.5">{user.totalCards} cartas · {user.totalDecks} mazos publicos</p>
      </div>
      <button onClick={isFollowing ? onUnfollow : onFollow}
        className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all shrink-0 ' + (
          isFollowing
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        )}>
        {isFollowing ? <><UserMinus size={12} /> Dejar</> : <><UserPlus size={12} /> Seguir</>}
      </button>
    </div>
  );
}