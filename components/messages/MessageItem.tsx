'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import dayjs from '@/lib/dayjs';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import {
  Check,
  CheckCheck,
  Download,
  Edit2,
  FileText,
  MoreHorizontal,
  Pin,
  Play,
  Plus,
  Reply,
  Smile,
  Trash2
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';


interface MessageItemProps {
  message: {
    _id: string;
    content: string;
    messageType?: string;
    mediaUrl?: string;
    senderId: string | { _id: string; name: string; profileImage?: string };
    replyTo?: { _id: string; content: string; messageType: string; senderName: string } | string | null;
    isPinned?: boolean;
    isEdited?: boolean;
    isDeleted?: boolean;
    createdAt: string;
    status?: string;
    reactions?: { userId: string; emoji: string; userName?: string }[];
  };
  isOwn: boolean;
  showAvatar: boolean;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReplyClick?: (msgId: string) => void;
}

export default function MessageItem({
  message,
  isOwn,
  showAvatar,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onReplyClick
}: MessageItemProps) {
  const [showReactorsModal, setShowReactorsModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed', error);
      window.open(url, '_blank');
    }
  };

  const isText = message.messageType === 'text';
  const isImage = message.messageType === 'image';
  const isDocument = message.messageType === 'document';
  const isAudio = message.messageType === 'audio';

  const isImageOnly = isImage && (!message.content || message.content === 'Photo' || message.content === 'Sent an image');
  const isEmojiOnly = isText && typeof message.content === 'string' && message.content.trim().length > 0 && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(message.content.trim());
  const hasNoBackground = isImageOnly || isEmojiOnly;

  return (
    <div className={cn(
      "group flex items-end gap-2 mb-1 w-full",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {!isOwn && showAvatar ? (
        <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer">
          <AvatarImage src={typeof message.senderId === 'object' ? message.senderId.profileImage : undefined} />
          <AvatarFallback className="bg-primary/10 text-xs text-primary font-bold">
            {(typeof message.senderId === 'object' ? message.senderId.name : 'U')?.charAt(0)}
          </AvatarFallback>
        </Avatar>
      ) : (
        !isOwn && <div className="w-8 flex-shrink-0" />
      )}

      <div className={cn(
        "relative flex flex-col w-full min-w-0",
        isOwn ? "items-end ml-10" : "items-start mr-10"
      )}>
        {showAvatar && !isOwn && (
          <span className="text-[10px] text-muted-foreground ml-1 mb-1 font-medium">
            {typeof message.senderId === 'object' ? message.senderId.name : 'Unknown User'}
          </span>
        )}

        {message.isPinned && (
          <div className="flex items-center gap-1 text-[10px] text-primary/80 mb-1 ml-1 font-bold italic uppercase tracking-tighter">
            <Pin className="w-3 h-3 fill-current" /> Pinned
          </div>
        )}
        <div className={cn(
          "flex items-center gap-2 w-full",
          isOwn ? "justify-end" : "justify-start"
        )}>
          {isOwn && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <MessageActions
                isOwn={isOwn}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                onPin={onPin}
                isPinned={message.isPinned}
              />
            </div>
          )}

          <div className={cn(
            "relative group/bubble inline-block text-left break-words max-w-full",
            hasNoBackground
              ? "bg-transparent shadow-none"
              : cn(
                "px-3 py-1.5 shadow-sm text-[15px]",
                isOwn
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                  : "bg-muted text-foreground rounded-2xl rounded-bl-sm border border-border/10",
                isImage && "p-1"
              ),
            isEmojiOnly && "text-5xl my-2",
            message.isDeleted && "opacity-50 italic"
          )}>
            {/* Reply Context */}
            {(() => {
              const reply = (message.replyTo && typeof message.replyTo === 'object')
                ? message.replyTo as { _id: string; content: string; messageType: string; senderName: string }
                : null;

              if (!reply || !reply.senderName) return null;

              return (
                <div
                  onClick={() => reply._id && onReplyClick?.(reply._id)}
                  className={cn(
                    "mb-2 p-2 rounded-lg text-xs border-l-4 bg-black/5 flex flex-col gap-0.5 cursor-pointer hover:opacity-80 transition-opacity",
                    isOwn ? "border-primary-foreground/50" : "border-primary/50"
                  )}
                >
                  <span className="font-bold opacity-80">{reply.senderName}</span>
                  <p className="line-clamp-1 italic text-[11px]">
                    {reply.messageType === 'text' ? reply.content : 'Image'}
                  </p>
                </div>
              );
            })()}

            {isText && <p className="leading-snug whitespace-pre-wrap">{message.content}</p>}

            {isImage && (
              <div className="flex flex-col gap-1.5">
                <div className="relative w-full min-h-[100px] h-auto rounded-xl overflow-hidden group/img">
                  <Image
                    src={message.mediaUrl || ''}
                    alt="Image"
                    width={500}
                    height={300}
                    className="w-full h-auto object-cover max-h-80 transition-transform hover:scale-[1.02] cursor-pointer"
                    onClick={() => setSelectedImage(message.mediaUrl || null)}
                  />
                </div>
                {message.content && message.content !== 'Photo' && message.content !== 'Sent an image' && (
                  <p className="leading-snug whitespace-pre-wrap text-[15px] px-1 pb-1 pt-1">{message.content}</p>
                )}
              </div>
            )}

            {isDocument && (
              <div className="flex items-center gap-3 p-2 bg-black/10 rounded-xl min-w-[200px]">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{message.content || 'Document.pdf'}</p>
                  <p className="text-[10px] opacity-70">1.2 MB</p>
                </div>
              </div>
            )}

            {isAudio && (
              <div className="flex items-center gap-3 p-1 min-w-[200px]">
                <Button size="icon" variant="ghost" className="rounded-full bg-primary-foreground/20 h-10 w-10 shrink-0">
                  <Play className="w-5 h-5 fill-current ml-1" />
                </Button>
                <div className="flex-1 space-y-1">
                  <div className="h-1 bg-primary-foreground/30 rounded-full w-full relative">
                    <div className="absolute left-0 top-0 h-full bg-primary-foreground w-1/3 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>0:12</span>
                    <span>0:45</span>
                  </div>
                </div>
              </div>
            )}

            <span className={cn(
              "float-right text-[11px] flex gap-1 items-center mt-2 ml-3 -mr-1 -mb-1",
              isOwn && !hasNoBackground ? "text-primary-foreground/80" : "text-muted-foreground"
            )}>
              {message.isEdited && !message.isDeleted && <span className="uppercase text-[9px] font-bold tracking-widest mr-0.5">Edited</span>}
              <span>{dayjs(message.createdAt).format('h:mm A')}</span>
              {isOwn && (
                message.status === 'read'
                  ? <CheckCheck className="w-[14px] h-[14px] text-blue-500" />
                  : <Check className="w-[14px] h-[14px]" />
              )}
            </span>
            <div className="clear-both" />

            {/* Reactions Display */}
            {message.reactions && message.reactions.length > 0 && (
              <div className={cn(
                "absolute -bottom-3 flex flex-wrap gap-1 z-20",
                isOwn ? "left-0" : "right-0"
              )}>
                {message.reactions.map((r, idx) => (
                  <div
                    key={idx}
                    onClick={() => setShowReactorsModal(true)}
                    className="bg-background border rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center gap-1 hover:scale-110 transition-transform cursor-pointer"
                    title={r.userName || r.userId}
                  >
                    <span>{r.emoji}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isOwn && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <MessageActions
                isOwn={isOwn}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                onPin={onPin}
                isPinned={message.isPinned}
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={showReactorsModal} onOpenChange={setShowReactorsModal}>
        <DialogContent className="max-w-xs rounded-2xl p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Message Reactions</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
            {message.reactions?.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">{r.userName || 'User'}</span>
                <span className="text-xl">{r.emoji}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-[65vw] max-h-[85vh] p-0 border-none bg-black/95 flex flex-col items-center justify-center shadow-2xl overflow-hidden rounded-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>View Image</DialogTitle>
            <DialogDescription>A full screen view of the selected image.</DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full h-[80vh] flex items-center justify-center group/modal">
              <Image
                src={selectedImage}
                alt="Zoomed"
                fill
                className="object-contain"
                unoptimized
              />
              <div className="absolute top-4 right-14 flex gap-2 transition-opacity duration-300">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(selectedImage);
                  }}
                  title="Download Image"
                >
                  <Download className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageActions({
  isOwn,
  isPinned,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin
}: {
  isOwn: boolean;
  isPinned?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  onPin?: () => void;
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [open, setOpen] = useState(false);
  const emojis = ['👍', '❤️', '😂', '😮', '😢'];

  return (
    <div className="flex items-center gap-1">
      <Popover
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) setTimeout(() => setShowPicker(false), 200);
        }}
      >
        <PopoverTrigger asChild>
          <button className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors group-hover:text-primary cursor-pointer">
            <Smile className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={isOwn ? 'end' : 'start'}
          className={cn(
            "bg-background/95 backdrop-blur-sm border shadow-lg",
            !showPicker ? "w-auto p-1 rounded-full flex items-center gap-1" : "p-0 rounded-2xl w-[300px]"
          )}
        >
          {!showPicker ? (
            <>
              {emojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(emoji);
                    setOpen(false);
                  }}
                  className="hover:scale-125 transition-transform p-1.5 text-lg leading-none cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
              <div className="w-px h-6 bg-border mx-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPicker(true);
                }}
                className="hover:bg-muted rounded-full p-1.5 text-muted-foreground transition-colors cursor-pointer"
                title="More emojis"
              >
                <Plus className="w-5 h-5" />
              </button>
            </>
          ) : (
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                onReact?.(emojiData.emoji);
                setOpen(false);
              }}
              theme={Theme.LIGHT}
              width={300}
              height={350}
              previewConfig={{ showPreview: false }}
            />
          )}
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-36">
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onReply}>
            <Reply className="w-4 h-4" /> Reply
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onPin}>
            <Pin className="w-4 h-4" /> {isPinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          {isOwn && (
            <>
              <DropdownMenuItem className="gap-2 cursor-pointer text-blue-500 focus:text-blue-500" onClick={onEdit}>
                <Edit2 className="w-4 h-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Message?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Button
              variant="destructive"
              className="w-full rounded-xl py-6"
              onClick={() => {
                onDelete?.(); // Logic for everyone would go here
                setShowDeleteModal(false);
              }}
            >
              Delete for everyone
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl py-6"
              onClick={() => setShowDeleteModal(false)}
            >
              Delete for me only
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="w-full rounded-xl" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
