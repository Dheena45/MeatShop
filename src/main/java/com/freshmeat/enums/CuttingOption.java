package com.freshmeat.enums;

public enum CuttingOption {
    CURRY_CUT("Curry Cut"),
    SMALL_PIECES("Small Pieces"),
    LARGE_PIECES("Large Pieces"),
    BONELESS("Boneless"),
    BIRYANI_CUT("Biryani Cut"),
    CHOPS("Chops"),
    KEEMA("Keema"),
    WHOLE("Whole"),
    SLICED("Sliced");

    private final String label;

    CuttingOption(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
