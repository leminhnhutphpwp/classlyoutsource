@extends('emails.layouts.app')

@section('content')
    <div class="greeting">
        {{ $greeting ?? 'Xin chào!' }}
    </div>

    <div class="body-content">
        {!! $body_html !!}
    </div>

    @if(isset($action_url) && isset($action_text))
    <div class="button-container">
        <a href="{{ $action_url }}" class="button">
            {{ $action_text }}
        </a>
    </div>
    @endif

    @if(isset($salutation))
    <div class="divider"></div>
    <p style="margin-bottom: 5px; font-weight: 500;">{{ $salutation }}</p>
    <p style="color: #6b7280; font-size: 14px;">Đội ngũ Classly</p>
    @endif
@endsection

