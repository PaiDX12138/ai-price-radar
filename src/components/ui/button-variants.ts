import { cva } from 'class-variance-authority';

// 与 desktop 的 buttonVariants 一致；额外加了 xl 尺寸给首页主按钮
export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]',
        ghost: 'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 gap-1.5 px-2.5',
        xs: 'h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs',
        sm: 'h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]',
        lg: 'h-9 gap-1.5 px-3',
        xl: 'h-11 gap-2 rounded-xl px-5 text-[0.95rem]',
        icon: 'size-8',
        'icon-xs': 'size-6 rounded-[min(var(--radius-md),10px)]',
        'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)]',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
