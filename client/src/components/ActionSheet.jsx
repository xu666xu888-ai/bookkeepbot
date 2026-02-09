export default function ActionSheet({ title, options, onSelect, onClose, visible, selectedValue }) {
    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] flex items-end justify-center animate-fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-[#1c1c1e] rounded-t-3xl border-t border-white/10 
                         max-h-[80dvh] overflow-hidden flex flex-col animate-slide-up safe-bottom shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle Bar */}
                <div className="flex justify-center pt-3 pb-2 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Title */}
                <div className="px-5 pb-3 shrink-0 border-b border-white/5">
                    <h3 className="text-center font-semibold text-white/90">{title}</h3>
                </div>

                {/* Options List */}
                <div className="overflow-y-auto p-4 space-y-2">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                onSelect(opt.value);
                                onClose();
                            }}
                            className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all active:scale-[0.99]
                                ${selectedValue === opt.value
                                    ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                    : 'bg-white/5 text-white/80 hover:bg-white/10'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <span>{opt.label}</span>
                                {selectedValue === opt.value && (
                                    <span className="text-lg leading-none">✓</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Cancel Button */}
                <div className="p-4 pt-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 rounded-xl bg-white/5 text-white/60 font-medium text-sm active:scale-[0.99]"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}
