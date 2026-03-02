"use client";

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Info,
  PenLine,
  Tag,
  Target as TargetIcon,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const schema = z.object({
  date: z.string().nonempty('Date is required'),
  profit: z.preprocess((val) => (val === "" ? 0 : Number(val)), z.number().min(0)),
  loss: z.preprocess((val) => (val === "" ? 0 : Number(val)), z.number().min(0)),
  riskRewardRatio: z.string().regex(/^\d+:\d+$/, 'Format must be 1:3'),
  notes: z.string().nonempty('Notes are mandatory'),
  tags: z.string().nonempty('At least one tag is mandatory'),
}).refine(data => {
  return (data.profit > 0 && data.loss === 0) || (data.loss > 0 && data.profit === 0) || (data.profit === 0 && data.loss === 0);
}, {
  message: "Provide either Profit or Loss, not both.",
  path: ["profit"]
});

interface DailyRecordFormProps {
  initialData?: {
    date?: string;
    profit?: number;
    loss?: number;
    riskRewardRatio?: string;
    notes?: string;
    tags?: string[];
  } | null;
  onSubmit: (data: { date: string; profit: number; loss: number; riskRewardRatio: string; notes: string; tags: string[] }) => void;
  isLoading?: boolean;
}

export default function DailyRecordForm({ initialData, onSubmit, isLoading }: DailyRecordFormProps) {
  // Use local date for default
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: initialData?.date ? initialData.date.split('T')[0] : today,
      profit: initialData?.profit || 0,
      loss: initialData?.loss || 0,
      riskRewardRatio: initialData?.riskRewardRatio || '1:3',
      notes: initialData?.notes || '',
      tags: initialData?.tags?.join(', ') || '',
    }
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const selectedDateStr = watch('date') as string;
  const profitValue = watch('profit') as number;
  const lossValue = watch('loss') as number;

  const handleFormSubmit = (data: { date: string; profit: number; loss: number; riskRewardRatio: string; notes: string; tags: string }) => {
    const formattedData = {
      ...data,
      tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : []
    };
    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 ">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

        {/* Date Field - Premium Picker */}
        <div className="space-y-2.5">
          <label className="text-sm font-semibold flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5" /> Date Selection
          </label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full h-12 justify-between text-left font-semibold rounded-xl border bg-card/50 border-border hover:border-primary/50 transition-all",
                  !selectedDateStr && "text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  {selectedDateStr ? format(parseISO(selectedDateStr), "MMMM dd, yyyy") : <span>Pick a date</span>}
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl border-2 shadow-2xl" align="start">
              <Calendar
                mode="single"
                selected={selectedDateStr ? parseISO(selectedDateStr) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setValue('date', format(date, 'yyyy-MM-dd'));
                    setIsCalendarOpen(false);
                  }
                }}
                initialFocus
                className="rounded-xl"
              />
            </PopoverContent>
          </Popover>
          <input type="hidden" {...register('date')} />
          {errors.date && <p className="text-destructive text-sm mt-1">{errors.date.message as string}</p>}
        </div>

        {/* RR Ratio Field */}
        <div className="space-y-2.5">
          <label className="text-sm font-semibold flex items-center gap-2">
            <TargetIcon className="w-3.5 h-3.5" /> Performance Ratio
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 text-primary group-focus-within:bg-primary group-focus-within:text-white transition-all duration-300">
              <span className="text-[10px] font-black italic">R:R</span>
            </div>
            <input
              type="text"
              placeholder="1:3"
              {...register('riskRewardRatio')}
              className="w-full h-12 pl-14 bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl px-4 outline-none focus:border-primary/50 transition-all font-black text-lg placeholder:font-normal placeholder:opacity-30"
            />
          </div>
          {errors.riskRewardRatio && <p className="text-destructive text-sm mt-1">{errors.riskRewardRatio.message as string}</p>}
        </div>

        {/* Profit Field */}
        <div className="space-y-2.5 relative">
          <label className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Growth Yield ($)
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-profit/10 text-profit transition-all">
              <TrendingUp size={16} className="stroke-[3]" />
            </div>
            <input
              type="number"
              step="0.01"
              disabled={lossValue > 0}
              {...register('profit')}
              placeholder="0.00"
              className="w-full h-12 pl-14 bg-profit/5 border border-profit/20 rounded-xl px-4 outline-none focus:border-profit focus:bg-profit/10 transition-all font-black text-xl text-profit disabled:opacity-20 disabled:grayscale transition-all placeholder:text-profit/20"
            />
            {lossValue > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-muted/50 text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                <Info size={10} /> Loss Active
              </div>
            )}
          </div>
        </div>

        {/* Loss Field */}
        <div className="space-y-2.5 relative">
          <label className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5" /> Drawdown Cost ($)
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-loss/10 text-loss transition-all">
              <TrendingDown size={16} className="stroke-[3]" />
            </div>
            <input
              type="number"
              step="0.01"
              disabled={profitValue > 0}
              {...register('loss')}
              placeholder="0.00"
              className="w-full h-12 pl-14 bg-loss/5 border border-loss/20 rounded-xl px-4 outline-none focus:border-loss focus:bg-loss/10 transition-all font-black text-xl text-loss disabled:opacity-20 disabled:grayscale transition-all placeholder:text-loss/20"
            />
            {profitValue > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-muted/50 text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                <Info size={10} /> Profit Active
              </div>
            )}
          </div>
        </div>
      </div>

      {errors.profit && !errors.loss && (
        <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-xl flex items-center justify-center gap-2 text-destructive">
          <Info size={14} />
          <p className="text-sm font-semibold">{errors.profit.message as string}</p>
        </div>
      )}

      {/* Tags Field */}
      <div className="space-y-2.5">
        <label className="text-sm font-semibold flex items-center gap-2">
          <Tag className="w-3.5 h-3.5" /> Contextual Identifiers
        </label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-accent/20 text-muted-foreground transition-all">
            <Tag size={16} />
          </div>
          <input
            type="text"
            placeholder="e.g., Gold, Daily Pivot, Scalp"
            {...register('tags')}
            className="w-full h-12 pl-14 bg-card/60 border-2 border-border/50 rounded-xl px-4 outline-none focus:border-primary/50 transition-all font-bold placeholder:font-normal placeholder:opacity-30"
          />
        </div>
        {errors.tags && <p className="text-destructive text-sm font-semibold mt-1">{errors.tags.message as string}</p>}
      </div>

      {/* Notes Field */}
      <div className="space-y-2.5">
        <label className="text-sm font-semibold flex items-center gap-2">
          <PenLine className="w-3.5 h-3.5" /> Analytical Summary
        </label>
        <div className="relative group">
          <div className="absolute left-4 top-4 p-2 rounded-lg bg-accent/20 text-muted-foreground transition-all">
            <PenLine size={16} />
          </div>
          <textarea
            rows={5}
            {...register('notes')}
            className="w-full pl-14 pt-6 bg-card/60 border border-border/50 rounded-xl px-6 outline-none focus:border-primary/50 transition-all font-medium leading-relaxed resize-none "
            placeholder="Explain the strategy, execution details and your emotional state during the trade..."
          />
        </div>
        {errors.notes && <p className="text-destructive text-sm font-semibold mt-1">{errors.notes.message as string}</p>}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="group text-black relative w-full h-12 bg-primary overflow-hidden rounded-xl font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale mt-2 cursor-pointer"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        {isLoading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-black">Synchronizing...</span>
          </div>
        ) : (
          <span className="text-black flex items-center justify-center gap-2">
            {initialData ? 'Update Record' : 'Commit Single Entry'}
          </span>
        )}
      </button>
    </form>
  );
}
