package application_test

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/gailsapp/gails/pkg/application"

	"github.com/matryer/is"
)

type mockNotifier struct {
	// mu protects Events from concurrent writes: the EventProcessor
	// dispatches notifications from a background goroutine, while the
	// test goroutine resets Events between assertions.
	mu     sync.Mutex
	Events []*application.CustomEvent
}

func (m *mockNotifier) dispatchEventToWindows(event *application.CustomEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Events = append(m.Events, event)
}

func (m *mockNotifier) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Events = []*application.CustomEvent{}
}

func Test_EventsOn(t *testing.T) {
	i := is.New(t)
	notifier := &mockNotifier{}
	eventProcessor := application.NewWailsEventProcessor(notifier.dispatchEventToWindows)

	// Test OnApplicationEvent
	eventName := "test"
	// counter is written from the listener goroutine spawned by
	// EventProcessor.Emit, so it must be read/written atomically.
	var counter atomic.Int32
	var wg sync.WaitGroup
	wg.Add(1)
	unregisterFn := eventProcessor.On(eventName, func(event *application.CustomEvent) {
		// This is called in a goroutine
		counter.Add(1)
		wg.Done()
	})
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	wg.Wait()
	i.Equal(int32(1), counter.Load())

	// Unregister
	notifier.Reset()
	unregisterFn()
	counter.Store(0)
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	i.Equal(int32(0), counter.Load())

}

func Test_EventsOnce(t *testing.T) {
	i := is.New(t)
	notifier := &mockNotifier{}
	eventProcessor := application.NewWailsEventProcessor(notifier.dispatchEventToWindows)

	// Test OnApplicationEvent
	eventName := "test"
	var counter atomic.Int32
	var wg sync.WaitGroup
	wg.Add(1)
	unregisterFn := eventProcessor.Once(eventName, func(event *application.CustomEvent) {
		// This is called in a goroutine
		counter.Add(1)
		wg.Done()
	})
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	wg.Wait()
	i.Equal(int32(1), counter.Load())

	// Unregister
	notifier.Reset()
	unregisterFn()
	counter.Store(0)
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	i.Equal(int32(0), counter.Load())

}
func Test_EventsOnMultiple(t *testing.T) {
	i := is.New(t)
	notifier := &mockNotifier{}
	eventProcessor := application.NewWailsEventProcessor(notifier.dispatchEventToWindows)

	// Test OnApplicationEvent
	eventName := "test"
	// OnMultiple can fire the listener concurrently from multiple
	// Emit goroutines; use an atomic counter so reads and writes
	// don't race.
	var counter atomic.Int32
	var wg sync.WaitGroup
	wg.Add(2)
	unregisterFn := eventProcessor.OnMultiple(eventName, func(event *application.CustomEvent) {
		// This is called in a goroutine
		counter.Add(1)
		wg.Done()
	}, 2)
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	wg.Wait()
	i.Equal(int32(2), counter.Load())

	// Unregister
	notifier.Reset()
	unregisterFn()
	counter.Store(0)
	_ = eventProcessor.Emit(&application.CustomEvent{
		Name: "test",
		Data: "test payload",
	})
	i.Equal(int32(0), counter.Load())

}
