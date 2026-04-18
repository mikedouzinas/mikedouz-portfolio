# Sidebar Nav Sliding Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the growing-bar nav indicator in the sidebar with a smooth sliding blue pill that animates to the active section.

**Architecture:** Single file edit to `sidebar_content.tsx`. A single absolutely-positioned pill div sits behind the nav list; its `top` is computed from the active section's index multiplied by a fixed item height, giving a CSS-transitioned slide effect.

**Tech Stack:** React, Tailwind CSS, inline styles for dynamic `top`/`opacity`

---

### Task 1: Replace nav indicator in `sidebar_content.tsx`

**Files:**
- Modify: `src/app/sidebar_content.tsx`

The current `<nav>` block renders per-item indicator bars. Replace the entire `<nav>...</nav>` block with the pill-based version below.

- [ ] **Step 1: Locate the nav block**

Open `src/app/sidebar_content.tsx`. Find this block (starts around line 82):

```tsx
{/* Navigation links aligned with the profile container */}
<nav className="mt-8 w-48 mx-auto hidden md:block">
    <ul className="space-y-4 text-left">
        {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
                <li key={item.id}>
                    <a
                        href={`#${item.id}`}
                        onClick={handleNavClick(item.id)}
                        className={`
          group flex items-center transition-all duration-300 ease-in-out 
          text-xs uppercase tracking-wide 
          ${isActive ? 'text-[#ff7f32] dark:text-blue-500' : 'text-gray-500 hover:text-[#ff7f32] dark:hover:text-blue-500'}`}>
                        <div className={`transition-all duration-300 ease-in-out ${isActive
                            ? 'bg-[#ff7f32] dark:bg-blue-500 w-4 mr-4'
                            : 'bg-gray-900 dark:bg-white w-2 mr-2 group-hover:w-4 group-hover:mr-4'} h-4`}
                        ></div>
                        <span>{item.label}</span>
                    </a>
                </li>
            );
        })}
    </ul>
</nav>
```

- [ ] **Step 2: Replace with pill-based nav**

Replace the entire block above with:

```tsx
{/* Navigation links with sliding pill indicator */}
<nav className="mt-8 w-48 mx-auto hidden md:block">
    {(() => {
        const ITEM_HEIGHT = 36;
        const activeIndex = navItems.findIndex(item => item.id === activeSection);
        return (
            <div style={{ position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    height: ITEM_HEIGHT,
                    borderRadius: 7,
                    background: 'rgba(96, 165, 250, 0.13)',
                    border: '1px solid rgba(96, 165, 250, 0.25)',
                    top: activeIndex >= 0 ? activeIndex * ITEM_HEIGHT : 0,
                    opacity: activeIndex >= 0 ? 1 : 0,
                    transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                    pointerEvents: 'none',
                }} />
                <ul>
                    {navItems.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                            <li key={item.id} style={{ height: ITEM_HEIGHT, display: 'flex', alignItems: 'center' }}>
                                <a
                                    href={`#${item.id}`}
                                    onClick={handleNavClick(item.id)}
                                    className={`
                                        text-xs uppercase tracking-wide font-medium w-full px-3
                                        transition-colors duration-200
                                        ${isActive
                                            ? 'text-blue-300 font-semibold'
                                            : 'text-gray-500 hover:text-gray-300'}
                                    `}
                                    style={{ position: 'relative', zIndex: 1 }}
                                >
                                    {item.label}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    })()}
</nav>
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev` if not already running. Open `http://localhost:3000`.

Expected:
- Sidebar nav shows About / Experience / Projects / Media with no bar indicators
- Scrolling to a section slides the blue pill to that item smoothly
- Clicking a nav item also slides the pill
- Pill is invisible on initial load before any section is active
- Profile photo, name, Iris button, Spotify bubble, and social icons are unchanged

- [ ] **Step 4: Commit**

```bash
git add src/app/sidebar_content.tsx
git commit -m "feat: replace sidebar nav bar indicator with sliding blue pill"
```
