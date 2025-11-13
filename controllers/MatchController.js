import Match from '../models/Match.js';

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export const getAllMatches = asyncHandler(async (req, res) => {
    const matches = await Match.find({});
    res.status(200).json(matches);
});

export const getMatchById = asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.id);

    if (!match) {
        return res.status(404).json({ message: 'Curated match not found.' });
    }
    
    res.status(200).json(match);
});

export const createMatch = asyncHandler(async (req, res) => {
    const newMatch = new Match(req.body);
    const savedMatch = await newMatch.save();
    res.status(201).json(savedMatch);
});

export const updateMatch = asyncHandler(async (req, res) => {
    const updatedMatch = await Match.findByIdAndUpdate(
        req.params.id, 
        req.body, 
        { new: true, runValidators: true } 
    );

    if (!updatedMatch) {
        return res.status(404).json({ message: 'Curated match not found for update.' });
    }
    res.status(200).json(updatedMatch);
});

export const deleteMatch = asyncHandler(async (req, res) => {
    const deletedMatch = await Match.findByIdAndDelete(req.params.id);

    if (!deletedMatch) {
        return res.status(404).json({ message: 'Curated match not found for deletion.' });
    }
    res.status(200).json({ message: 'Curated match successfully deleted.' });
});